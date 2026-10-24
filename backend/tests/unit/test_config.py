from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy.engine import make_url

from app.core.config import REPOSITORY_ROOT, SERVICE_NAME, Settings


def test_defaults_are_local_and_use_tracesync():
    settings = Settings(_env_file=None)
    assert SERVICE_NAME == "TraceSync API"
    assert settings.environment == "local"
    assert settings.log_level == "INFO"
    assert Path(make_url(settings.database_url).database) == (
        REPOSITORY_ROOT / "data/local/tracesync.db"
    )
    assert settings.cors_origins == ["http://localhost:5173", "http://127.0.0.1:5173"]
    assert "database_url" not in repr(settings)


def test_dotenv_loads_and_environment_takes_precedence(tmp_path, monkeypatch):
    dotenv = tmp_path / ".env"
    dotenv.write_text(
        'TRACESYNC_ENVIRONMENT=test\nTRACESYNC_LOG_LEVEL=INFO\n'
        'TRACESYNC_DATABASE_URL=sqlite:///data/local/settings-test.db\n'
        'TRACESYNC_CORS_ORIGINS=["http://localhost:9000/"]\n',
        encoding="utf-8",
    )
    monkeypatch.setenv("TRACESYNC_LOG_LEVEL", "WARNING")
    settings = Settings(_env_file=dotenv)
    assert settings.environment == "test"
    assert settings.log_level == "WARNING"
    assert settings.cors_origins == ["http://localhost:9000"]
    assert Path(make_url(settings.database_url).database) == (
        REPOSITORY_ROOT / "data/local/settings-test.db"
    )


def test_environment_database_and_json_origins_load(monkeypatch, tmp_path):
    url = f"sqlite:///{(tmp_path / 'environment.db').as_posix()}"
    monkeypatch.setenv("TRACESYNC_DATABASE_URL", url)
    monkeypatch.setenv("TRACESYNC_CORS_ORIGINS", '["http://127.0.0.1:1234"]')
    settings = Settings(_env_file=None)
    assert settings.database_url == url
    assert settings.cors_origins == ["http://127.0.0.1:1234"]


@pytest.mark.parametrize("url", [
    "not-a-url", "postgresql://localhost/db", "sqlite+aiosqlite:///:memory:",
    "sqlite:///example.db?mode=ro", "sqlite://user:password@localhost/db",
])
def test_invalid_or_unsupported_database_configuration_fails(url):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url=url)


@pytest.mark.parametrize("origin", ["*", "http://*", "http://localhost:5173/path", "ftp://localhost"])
def test_cors_requires_explicit_http_origins(origin):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, cors_origins=[origin])
