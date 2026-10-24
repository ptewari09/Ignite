from hashlib import sha256
from uuid import uuid4

from alembic import command
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import func, inspect, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models import Cycle, Project, TransformationFinding, UploadErrorMessage, UploadObjectRecord, Workbook
from app.db.session import create_database_engine
from app.main import create_app
from app.scripts.generate_demo_workbooks import post_upload_bytes, transformation_bytes
from app.services import ingestion
from tests.fixtures.workbooks import mutate


def create_cycle(client, project_id=None, name="Synthetic cycle"):
    if project_id is None:
        response = client.post("/api/v1/projects", json={"name": "Synthetic project", "description": "Fictional demo"})
        assert response.status_code == 201
        project_id = response.json()["id"]
    response = client.post(f"/api/v1/projects/{project_id}/cycles", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"], project_id


def upload(client, cycle_id, role, content, filename="synthetic.xlsx"):
    return client.post(
        f"/api/v1/cycles/{cycle_id}/workbooks", data={"role": role},
        files={"file": (filename, content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )


def cycle_status(client, project_id, cycle_id):
    return next(item["ingestion_status"] for item in client.get(f"/api/v1/projects/{project_id}/cycles").json()["items"] if item["id"] == cycle_id)


def test_projects_cycles_validation_and_parent_scoping(client):
    assert client.post("/api/v1/projects", json={"name": "   "}).status_code == 422
    cycle_id, project_id = create_cycle(client)
    other_cycle, other_project = create_cycle(client)
    assert client.get("/api/v1/projects?limit=1").json()["total"] == 2
    cycles = client.get(f"/api/v1/projects/{project_id}/cycles").json()
    assert [item["id"] for item in cycles["items"]] == [cycle_id]
    assert cycles["items"][0]["ingestion_status"] == "empty"
    assert cycles["items"][0]["created_at"].endswith("Z")
    assert other_project != project_id and other_cycle != cycle_id
    assert client.get(f"/api/v1/projects/{uuid4()}/cycles").status_code == 404
    assert client.post(f"/api/v1/projects/{uuid4()}/cycles", json={"name": "Missing parent"}).status_code == 404
    assert client.post(f"/api/v1/projects/{project_id}/cycles", json={"name": ""}).status_code == 422


def test_both_roles_ingest_and_retrieve_all_evidence_with_provenance(client):
    cycle_id, project_id = create_cycle(client)
    content = transformation_bytes()
    response = upload(client, cycle_id, "transformation", content, "synthetic.XLSX")
    assert response.status_code == 201
    workbook = response.json()["workbook"]
    assert response.json()["duplicate"] is False
    assert workbook["sha256"] == sha256(content).hexdigest()
    assert workbook["row_counts"] == {"Detailed_LOG": 3}
    assert workbook["original_filename"] == "synthetic.XLSX"
    assert cycle_status(client, project_id, cycle_id) == "partial"
    records = client.get(f"/api/v1/cycles/{cycle_id}/transformation-findings").json()
    assert records["total"] == 3
    assert [record["excel_row_number"] for record in records["items"]] == [2, 4, 5]
    assert all(record["workbook_id"] == workbook["id"] for record in records["items"])
    assert records["items"][0]["object_name_raw"] == " z_demo_order "
    assert records["items"][0]["object_name_normalized"] == "Z_DEMO_ORDER"
    assert records["items"][2]["object_name_raw"] is None
    response = upload(client, cycle_id, "post_upload", post_upload_bytes())
    assert response.status_code == 201
    assert response.json()["workbook"]["row_counts"] == {"Objects": 3, "Errors": 4}
    assert cycle_status(client, project_id, cycle_id) == "complete"
    objects = client.get(f"/api/v1/cycles/{cycle_id}/upload-objects").json()
    assert objects["total"] == 3
    assert objects["items"][0]["tool_status_raw"] == "UPLD_ERROR"
    assert objects["items"][0]["manual_status_raw"] == "Uploaded"
    assert objects["items"][0]["manual_comments_raw"] == "Synthetic review comment A."
    errors = client.get(f"/api/v1/cycles/{cycle_id}/upload-errors").json()
    assert errors["total"] == 4
    assert errors["items"][1]["object_type_raw"] == "    "
    assert errors["items"][1]["object_type_normalized"] is None
    assert errors["items"][2]["message_type_raw"] == "   "
    assert client.get(f"/api/v1/cycles/{cycle_id}/workbooks").json()["total"] == 2


def test_identical_bytes_are_idempotent_and_different_bytes_conflict(client):
    cycle_id, _ = create_cycle(client)
    content = transformation_bytes()
    first = upload(client, cycle_id, "transformation", content)
    repeated = upload(client, cycle_id, "transformation", content, "another-name.xlsx")
    assert repeated.status_code == 200 and repeated.json()["duplicate"] is True
    assert first.json()["workbook"]["id"] == repeated.json()["workbook"]["id"]
    changed = mutate(content, lambda book: setattr(book["Detailed_LOG"]["E2"], "value", "Different synthetic message."))
    conflict = upload(client, cycle_id, "transformation", changed)
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "WORKBOOK_ROLE_OCCUPIED"
    assert client.get(f"/api/v1/cycles/{cycle_id}/transformation-findings").json()["total"] == 3
    assert client.get(f"/api/v1/cycles/{cycle_id}/workbooks").json()["total"] == 1


def test_same_file_is_allowed_in_another_cycle_and_evidence_is_scoped(client):
    first, project_id = create_cycle(client)
    second, _ = create_cycle(client, project_id, "Another synthetic cycle")
    content = transformation_bytes()
    a = upload(client, first, "transformation", content)
    b = upload(client, second, "transformation", content)
    assert a.status_code == b.status_code == 201
    assert a.json()["workbook"]["id"] != b.json()["workbook"]["id"]
    assert client.get(f"/api/v1/cycles/{first}/transformation-findings").json()["total"] == 3
    assert client.get(f"/api/v1/cycles/{second}/upload-errors").json()["total"] == 0


@pytest.mark.parametrize("suffix", ["workbooks", "transformation-findings", "upload-objects", "upload-errors"])
def test_empty_cycle_pages_and_missing_cycle_errors(client, suffix):
    cycle_id, _ = create_cycle(client)
    response = client.get(f"/api/v1/cycles/{cycle_id}/{suffix}")
    assert response.status_code == 200 and response.json()["items"] == []
    assert client.get(f"/api/v1/cycles/{uuid4()}/{suffix}").status_code == 404


def test_upload_requires_existing_cycle_and_supported_role(client):
    response = upload(client, uuid4(), "transformation", transformation_bytes())
    assert response.status_code == 404
    cycle_id, _ = create_cycle(client)
    assert upload(client, cycle_id, "reference", transformation_bytes()).status_code == 422


@pytest.mark.parametrize("filename,content,code,status", [
    ("source.csv", b"not excel", "UNSUPPORTED_FILE_TYPE", 415),
    ("source.xlsx", b"not excel", "INVALID_WORKBOOK", 422),
    ("source.xlsx", b"", "INVALID_WORKBOOK", 422),
])
def test_invalid_uploads_are_actionable_without_source_contents(client, filename, content, code, status):
    cycle_id, _ = create_cycle(client)
    response = upload(client, cycle_id, "transformation", content, filename)
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert client.get(f"/api/v1/cycles/{cycle_id}/workbooks").json()["total"] == 0


def test_missing_sheet_or_header_does_not_leave_partial_post_upload(client):
    cycle_id, project_id = create_cycle(client)
    content = mutate(post_upload_bytes(), lambda book: book.remove(book["Errors"]))
    response = upload(client, cycle_id, "post_upload", content)
    assert response.status_code == 422 and response.json()["error"]["code"] == "MISSING_WORKSHEETS"
    content = mutate(post_upload_bytes(), lambda book: setattr(book["Errors"]["F1"], "value", "Wrong column"))
    response = upload(client, cycle_id, "post_upload", content)
    assert response.status_code == 422 and response.json()["error"]["code"] == "MISSING_COLUMNS"
    assert client.get(f"/api/v1/cycles/{cycle_id}/upload-objects").json()["total"] == 0
    assert client.get(f"/api/v1/cycles/{cycle_id}/workbooks").json()["total"] == 0
    assert cycle_status(client, project_id, cycle_id) == "empty"


def test_configured_maximum_upload_size_is_enforced(client, settings):
    cycle_id, _ = create_cycle(client)
    app = create_app(settings.model_copy(update={"max_upload_bytes": 100}))
    with TestClient(app) as limited:
        response = upload(limited, cycle_id, "transformation", transformation_bytes())
    assert response.status_code == 413 and response.json()["error"]["code"] == "UPLOAD_TOO_LARGE"
    assert client.get(f"/api/v1/cycles/{cycle_id}/workbooks").json()["total"] == 0


def test_pagination_is_stable_and_validated(client):
    cycle_id, _ = create_cycle(client)
    upload(client, cycle_id, "transformation", transformation_bytes())
    page = client.get(f"/api/v1/cycles/{cycle_id}/transformation-findings?limit=1&offset=1").json()
    assert page["total"] == 3 and page["limit"] == page["offset"] == 1
    assert len(page["items"]) == 1 and page["items"][0]["excel_row_number"] == 4
    assert client.get(f"/api/v1/cycles/{cycle_id}/transformation-findings?offset=99").json()["items"] == []
    assert client.get(f"/api/v1/cycles/{cycle_id}/transformation-findings?limit=0").status_code == 422
    assert client.get(f"/api/v1/cycles/{cycle_id}/upload-errors?offset=-1").status_code == 422


def test_transaction_failure_rolls_back_metadata_rows_and_cycle_status(client, monkeypatch, caplog):
    cycle_id, project_id = create_cycle(client)
    original = ingestion.persist_records

    def failing_persistence(session, workbook_id, parsed):
        original(session, workbook_id, parsed)
        session.flush()  # failures after actual inserts must still roll everything back
        raise RuntimeError("private-source-bearing-failure")

    monkeypatch.setattr(ingestion, "persist_records", failing_persistence)
    response = upload(client, cycle_id, "post_upload", post_upload_bytes())
    assert response.status_code == 500 and response.json()["error"]["code"] == "INGESTION_FAILED"
    assert "private-source-bearing-failure" not in response.text + caplog.text
    assert client.get(f"/api/v1/cycles/{cycle_id}/workbooks").json()["total"] == 0
    assert client.get(f"/api/v1/cycles/{cycle_id}/upload-objects").json()["total"] == 0
    assert client.get(f"/api/v1/cycles/{cycle_id}/upload-errors").json()["total"] == 0
    assert cycle_status(client, project_id, cycle_id) == "empty"


def test_source_data_and_filenames_do_not_appear_in_application_logs(client, caplog):
    cycle_id, _ = create_cycle(client)
    with caplog.at_level("INFO", logger="tracesync"):
        response = upload(client, cycle_id, "post_upload", post_upload_bytes(), "private-filename.xlsx")
    assert response.status_code == 201
    logs = "\n".join(record.getMessage() for record in caplog.records if record.name.startswith("tracesync"))
    for secret in ("Z_DEMO_ORDER", "Fictional request", "private-filename", "Synthetic review comment"):
        assert secret not in logs


def test_ingestion_schema_matches_models_and_upgrade_preserves_existing_project(settings, migration_config):
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext

    command.upgrade(migration_config, "0001_create_projects")
    engine = create_database_engine(settings)
    try:
        with Session(engine) as session:
            project = Project(name="Pre-existing synthetic project")
            session.add(project)
            session.commit()
            project_id = project.id
        command.upgrade(migration_config, "head")
        expected = {"projects", "cycles", "workbooks", "transformation_findings", "upload_objects", "upload_errors", "alembic_version"}
        assert set(inspect(engine).get_table_names()) == expected
        with engine.connect() as connection:
            assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
        command.downgrade(migration_config, "0001_create_projects")
        with Session(engine) as session:
            assert session.get(Project, project_id).name == "Pre-existing synthetic project"
        command.upgrade(migration_config, "head")
    finally:
        engine.dispose()
