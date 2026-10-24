"""Validated settings shared by the API and Alembic."""

from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
SERVICE_NAME = "TraceSync API"
API_PREFIX = "/api/v1"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="TRACESYNC_",
        env_file=REPOSITORY_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    environment: Literal["local", "test"] = "local"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    database_url: str = Field(
        default="sqlite+pysqlite:///data/local/tracesync.db", repr=False
    )
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        try:
            url = make_url(value)
        except ArgumentError:
            raise ValueError("Database URL must be a valid SQLite URL") from None
        if url.drivername not in {"sqlite", "sqlite+pysqlite"}:
            raise ValueError("This local foundation supports SQLite with pysqlite")
        if url.host or url.username or url.password or url.port:
            raise ValueError("SQLite URLs must refer to a local database")
        if url.query:
            raise ValueError("SQLite URI/query options are not supported in this foundation")
        if url.database and url.database != ":memory:":
            path = Path(url.database)
            if not path.is_absolute():
                path = REPOSITORY_ROOT / path
            url = url.set(database=path.resolve().as_posix())
        return url.render_as_string(hide_password=False)

    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, origins: list[str]) -> list[str]:
        normalized = []
        for origin in origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or "*" in parsed.netloc
                or parsed.username is not None
                or parsed.password is not None
                or parsed.path not in {"", "/"}
                or parsed.query
                or parsed.fragment
            ):
                raise ValueError("CORS entries must be explicit HTTP(S) origins")
            normalized.append(origin.rstrip("/"))
        return normalized
