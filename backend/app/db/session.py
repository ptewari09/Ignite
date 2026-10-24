from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import Settings


def create_database_engine(settings: Settings) -> Engine:
    url = make_url(settings.database_url)
    options = {}
    if url.database in {None, "", ":memory:"}:
        options["poolclass"] = StaticPool
    return create_engine(
        url,
        connect_args={"check_same_thread": False, "timeout": 3},
        pool_pre_ping=True,
        hide_parameters=True,
        **options,
    )


def get_session(request: Request) -> Iterator[Session]:
    factory: sessionmaker[Session] = request.app.state.session_factory
    # Callers must explicitly commit writes; closing rolls back unfinished work.
    with factory() as session:
        yield session
