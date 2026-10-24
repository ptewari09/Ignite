import logging

from fastapi import Query
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_health_and_openapi_use_tracesync_api(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "TraceSync API"}
    assert response.headers["x-request-id"]
    assert client.get("/openapi.json").json()["info"]["title"] == "TraceSync API"


def test_ready_connects_to_migrated_temporary_database(client):
    response = client.get("/api/v1/ready")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ready", "service": "TraceSync API", "database": "connected"
    }


def test_database_unavailable_returns_503_without_internal_path(tmp_path, caplog):
    database_path = tmp_path / "missing-parent" / "unavailable.db"
    settings = Settings(_env_file=None, environment="test", database_url=f"sqlite:///{database_path.as_posix()}")
    with TestClient(create_app(settings)) as test_client:
        assert test_client.get("/api/v1/health").status_code == 200
        response = test_client.get("/api/v1/ready")
    assert response.status_code == 503
    assert response.json()["error"] == {
        "code": "DATABASE_UNAVAILABLE", "message": "Database connection is unavailable."
    }
    assert response.json()["request_id"] == response.headers["x-request-id"]
    assert str(tmp_path) not in response.text
    assert str(tmp_path) not in caplog.text
    assert not database_path.exists()


def test_startup_and_health_do_not_create_database_or_schema(settings, tmp_path):
    with TestClient(create_app(settings)) as test_client:
        assert not (tmp_path / "test.db").exists()
        assert test_client.get("/api/v1/health").status_code == 200
        assert not (tmp_path / "test.db").exists()


def test_cors_allows_configured_frontend_and_rejects_other_origins(client):
    allowed = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "X-Request-ID" in allowed.headers["access-control-expose-headers"]
    denied = client.get("/api/v1/health", headers={"Origin": "http://unconfigured.example"})
    assert "access-control-allow-origin" not in denied.headers


def test_http_errors_use_consistent_envelope(client):
    response = client.get("/api/v1/not-present")
    assert response.status_code == 404
    assert response.json()["error"] == {"code": "HTTP_ERROR", "message": "Not Found"}
    assert response.json()["request_id"] == response.headers["x-request-id"]
    method_error = client.post("/api/v1/health")
    assert method_error.status_code == 405
    assert method_error.headers["allow"] == "GET"


def test_validation_errors_do_not_echo_input_values(settings):
    application = create_app(settings)

    @application.get("/test-validation")
    def test_validation(value: int = Query(gt=0)):
        return {"value": value}

    with TestClient(application) as test_client:
        response = test_client.get("/test-validation?value=private-invalid-value")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "private-invalid-value" not in response.text


def test_unexpected_errors_do_not_disclose_details(settings, caplog):
    application = create_app(settings)

    @application.get("/test-error")
    def test_error():
        raise RuntimeError("private-exception-details")

    with TestClient(application, raise_server_exceptions=False) as test_client:
        response = test_client.get("/test-error")
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert response.json()["request_id"] == response.headers["x-request-id"]
    assert "private-exception-details" not in response.text
    assert "private-exception-details" not in caplog.text


def test_request_logs_contain_metadata_without_query_or_headers(client, caplog):
    with caplog.at_level(logging.INFO, logger="tracesync.requests"):
        response = client.get(
            "/api/v1/health?token=private-query-token",
            headers={"Authorization": "Bearer private-authorization-token"},
        )
    logs = "\n".join(record.getMessage() for record in caplog.records if record.name == "tracesync.requests")
    assert "method=GET" in logs and "route=/api/v1/health" in logs and "status=200" in logs
    assert response.headers["x-request-id"] in logs
    assert "private-query-token" not in logs and "private-authorization-token" not in logs


def test_logs_use_parameter_template_instead_of_actual_identifier(settings, caplog):
    application = create_app(settings)

    @application.get("/api/v1/test-objects/{object_name}")
    def test_object(object_name: str):
        return {"ok": True}

    with caplog.at_level(logging.INFO, logger="tracesync.requests"):
        with TestClient(application) as test_client:
            test_client.get("/api/v1/test-objects/private-object-identifier")
    logs = "\n".join(record.getMessage() for record in caplog.records if record.name == "tracesync.requests")
    assert "route=/api/v1/test-objects/{object_name}" in logs
    assert "private-object-identifier" not in logs
