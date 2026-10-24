from datetime import UTC, datetime, timedelta, timezone
from uuid import UUID

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import MetaData, inspect, text
from sqlalchemy.exc import StatementError
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models import Project
from app.db.session import create_database_engine


def test_initial_migration_creates_only_expected_schema(settings, migration_config):
    command.upgrade(migration_config, "0001_create_projects")
    engine = create_database_engine(settings)
    try:
        inspector = inspect(engine)
        assert set(inspector.get_table_names()) == {"projects", "alembic_version"}
        columns = {col["name"]: col for col in inspector.get_columns("projects")}
        assert set(columns) == {"id", "name", "description", "created_at", "updated_at"}
        assert columns["id"]["primary_key"]
        assert columns["description"]["nullable"]
        assert all(not columns[name]["nullable"] for name in ("id", "name", "created_at", "updated_at"))
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "0001_create_projects"
            initial_metadata = MetaData()
            Project.__table__.to_metadata(initial_metadata)
            assert compare_metadata(MigrationContext.configure(connection), initial_metadata) == []
        command.upgrade(migration_config, "0001_create_projects")  # repeated upgrades must be safe
        command.downgrade(migration_config, "base")
        assert "projects" not in inspect(engine).get_table_names()
        command.upgrade(migration_config, "0001_create_projects")
        assert "projects" in inspect(engine).get_table_names()
    finally:
        engine.dispose()


def test_project_persists_uuid_utc_timestamps_and_updates(settings, migration_config):
    command.upgrade(migration_config, "head")
    engine = create_database_engine(settings)
    old_time = datetime(2020, 1, 1, tzinfo=UTC)
    try:
        with Session(engine) as session:
            project = Project(name="Synthetic demo", created_at=old_time, updated_at=old_time)
            session.add(project)
            session.commit()
            project_id = project.id
            assert isinstance(project_id, UUID)
        with Session(engine) as session:
            restored = session.get(Project, project_id)
            assert restored.created_at == old_time
            assert restored.updated_at.utcoffset() == timedelta(0)
            restored.description = "Reviewed synthetic description"
            session.commit()
            session.refresh(restored)
            assert restored.updated_at > old_time
            assert restored.updated_at.utcoffset() == timedelta(0)
    finally:
        engine.dispose()


def test_timezone_offsets_are_normalized_and_naive_timestamps_rejected(settings, migration_config):
    command.upgrade(migration_config, "head")
    engine = create_database_engine(settings)
    local_time = datetime(2025, 1, 1, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    try:
        with Session(engine) as session:
            project = Project(name="Offset example", created_at=local_time)
            session.add(project)
            session.commit()
            session.refresh(project)
            assert project.created_at == datetime(2024, 12, 31, 18, 30, tzinfo=UTC)
            session.add(Project(name="Invalid time", created_at=datetime(2025, 1, 1)))
            with pytest.raises(StatementError, match="Timestamps must include a timezone"):
                session.commit()
            session.rollback()
    finally:
        engine.dispose()
