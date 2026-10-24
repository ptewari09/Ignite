from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy.engine import make_url

from app.core.config import Settings
from app.db.base import Base
from app.db.models import Project  # noqa: F401 -- register model metadata
from app.db.session import create_database_engine

config = context.config
if (
    config.config_file_name
    and config.get_section("loggers")
    and config.attributes.get("configure_logger", True)
):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

settings = config.attributes.get("settings")
if settings is None:
    settings = Settings()
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = make_url(settings.database_url)
    if url.database not in {None, "", ":memory:"}:
        # Only the explicit migration command creates the database directory.
        Path(url.database).parent.mkdir(parents=True, exist_ok=True)
    engine = create_database_engine(settings)
    try:
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
