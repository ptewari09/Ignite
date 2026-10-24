import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


@pytest.fixture(autouse=True)
def isolate_environment(monkeypatch):
    for key in list(os.environ):
        if key.upper().startswith("TRACESYNC_"):
            monkeypatch.delenv(key)


@pytest.fixture
def settings(tmp_path):
    return Settings(
        _env_file=None,
        environment="test",
        database_url=f"sqlite+pysqlite:///{(tmp_path / 'test.db').as_posix()}",
    )


@pytest.fixture
def migration_config(settings):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.attributes["settings"] = settings
    config.attributes["configure_logger"] = False
    return config


@pytest.fixture
def client(settings, migration_config):
    command.upgrade(migration_config, "head")
    with TestClient(create_app(settings)) as test_client:
        yield test_client
