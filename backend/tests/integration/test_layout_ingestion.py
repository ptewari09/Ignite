import pytest

from app.scripts.generate_demo_workbooks import post_upload_bytes
from app.services import ingestion
from tests.fixtures.workbooks import mutate, raw_post_upload_bytes, transformation_layout_bytes
from tests.integration.test_ingestion import create_cycle, cycle_status, upload


def all_evidence(client, cycle_id, endpoint):
    """Exercise API pagination instead of assuming everything fits one page."""
    rows = []
    while True:
        response = client.get(f"/api/v1/cycles/{cycle_id}/{endpoint}", params={"limit": 1, "offset": len(rows)})
        assert response.status_code == 200
        page = response.json()
        assert page["offset"] == len(rows) and page["limit"] == 1
        rows.extend(page["items"])
        if len(rows) == page["total"]:
            return rows
        assert page["items"]


@pytest.mark.parametrize("raw", [False, True], ids=["named-layout", "raw-layout"])
def test_layouts_persist_provenance_nulls_pagination_duplicates_and_conflicts(client, raw):
    cycle_id, project_id = create_cycle(client)
    transformation_sheet = "Detailed_Log" if raw else "Detailed_LOG"
    object_sheet, error_sheet = ("Sheet1", "Sheet2") if raw else ("Objects", "Errors")
    a = upload(client, cycle_id, "transformation", transformation_layout_bytes(transformation_sheet))
    assert a.status_code == 201
    assert a.json()["workbook"]["role"] == "transformation"
    assert a.json()["workbook"]["row_counts"] == {transformation_sheet: 3}
    content = raw_post_upload_bytes() if raw else post_upload_bytes()
    first = upload(client, cycle_id, "post_upload", content, "fictional-source.xlsx")
    assert first.status_code == 201
    workbook = first.json()["workbook"]
    assert workbook["role"] == "post_upload"
    assert workbook["row_counts"] == {object_sheet: 3, error_sheet: 4}
    assert workbook["sheets_found"] == [object_sheet, error_sheet]
    assert cycle_status(client, project_id, cycle_id) == "complete"

    findings = all_evidence(client, cycle_id, "transformation-findings")
    objects = all_evidence(client, cycle_id, "upload-objects")
    messages = all_evidence(client, cycle_id, "upload-errors")
    assert [r["excel_row_number"] for r in findings] == [2, 4, 5]
    assert all(r["worksheet_name"] == transformation_sheet for r in findings)
    assert len(objects) == 3 and [r["excel_row_number"] for r in objects] == [2, 3, 4]
    assert len({r["id"] for r in objects}) == 3
    assert objects[0]["object_name_normalized"] == objects[1]["object_name_normalized"] == "Z_DEMO_ORDER"
    assert all(r["worksheet_name"] == object_sheet and r["workbook_id"] == workbook["id"] for r in objects)
    assert len(messages) == 4 and all(r["worksheet_name"] == error_sheet for r in messages)
    assert [r["sequence_number"] for r in messages] == ([1, 2, 7, 11] if raw else [1, 2, 3, 1])
    assert messages[1]["object_name_raw"] is None
    if raw:
        for row in objects:
            for field in ("tool_status_raw", "re_upload_raw", "manual_status_raw", "manual_comments_raw"):
                assert row[field] is None
            assert set(row["raw_payload"]) == {"Status Inf", "Object Typ", "Object Name".ljust(30)}
        assert objects[0]["object_name_raw"] == "z_demo_order".ljust(30)
        assert any(w["code"] == "MISSING_OPTIONAL_COLUMNS" and w["count"] == 4 for w in workbook["warnings"])
    else:
        assert objects[0]["tool_status_raw"] == "UPLD_ERROR"
        assert objects[0]["manual_status_raw"] == "Uploaded"
        assert objects[0]["manual_comments_raw"] == "Synthetic review comment A."

    duplicate = upload(client, cycle_id, "post_upload", content, "renamed-source.xlsx")
    assert duplicate.status_code == 200 and duplicate.json()["duplicate"] is True
    assert duplicate.json()["workbook"] == workbook
    changed = mutate(content, lambda book: book[error_sheet].cell(2, 6, "Different fictional diagnostic."))
    conflict = upload(client, cycle_id, "post_upload", changed)
    assert conflict.status_code == 409 and conflict.json()["error"]["code"] == "WORKBOOK_ROLE_OCCUPIED"
    assert all_evidence(client, cycle_id, "upload-objects") == objects
    assert all_evidence(client, cycle_id, "upload-errors") == messages
    assert len(all_evidence(client, cycle_id, "workbooks")) == 2


def test_raw_present_blank_column_remains_in_persisted_payload(client):
    cycle_id, _ = create_cycle(client)
    content = mutate(raw_post_upload_bytes(), lambda book: book["Sheet1"].cell(1, 4, "Status    "))
    assert upload(client, cycle_id, "post_upload", content).status_code == 201
    row = all_evidence(client, cycle_id, "upload-objects")[0]
    assert row["tool_status_raw"] is None
    assert "Status    " in row["raw_payload"] and row["raw_payload"]["Status    "] is None
    assert "Re Upload" not in row["raw_payload"]


@pytest.mark.parametrize("failure", ["invalid-message", "ambiguous-layout"])
def test_failed_raw_import_keeps_existing_transformation_and_no_partial_records(client, failure):
    cycle_id, project_id = create_cycle(client)
    assert upload(client, cycle_id, "transformation", transformation_layout_bytes("Detailed_Log")).status_code == 201
    if failure == "invalid-message":
        content = mutate(raw_post_upload_bytes(), lambda book: book["Sheet2"].cell(2, 2, "invalid"))
        code = "INVALID_SEQUENCE"
    else:
        def add_layout(book):
            book.copy_worksheet(book["Sheet1"]).title = "Objects"
            book.copy_worksheet(book["Sheet2"]).title = "Errors"
        content = mutate(raw_post_upload_bytes(), add_layout)
        code = "AMBIGUOUS_LAYOUT"
    failed = upload(client, cycle_id, "post_upload", content)
    assert failed.status_code == 422 and failed.json()["error"]["code"] == code
    assert all_evidence(client, cycle_id, "upload-objects") == []
    assert all_evidence(client, cycle_id, "upload-errors") == []
    assert len(all_evidence(client, cycle_id, "workbooks")) == 1
    assert len(all_evidence(client, cycle_id, "transformation-findings")) == 3
    assert cycle_status(client, project_id, cycle_id) == "partial"


def test_raw_persistence_failure_rolls_back_inserted_null_records(client, monkeypatch):
    cycle_id, project_id = create_cycle(client)
    original = ingestion.persist_records

    def fail_after_flush(session, workbook_id, parsed):
        original(session, workbook_id, parsed)
        session.flush()
        raise RuntimeError("fictional-transaction-failure")

    monkeypatch.setattr(ingestion, "persist_records", fail_after_flush)
    failed = upload(client, cycle_id, "post_upload", raw_post_upload_bytes())
    assert failed.status_code == 500 and failed.json()["error"]["code"] == "INGESTION_FAILED"
    for endpoint in ("workbooks", "upload-objects", "upload-errors"):
        assert all_evidence(client, cycle_id, endpoint) == []
    assert cycle_status(client, project_id, cycle_id) == "empty"
