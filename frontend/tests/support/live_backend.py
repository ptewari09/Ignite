"""Test-owned FastAPI process; never connect to the normal database."""

import argparse
import json
import os
import sqlite3
from pathlib import Path

from alembic import command
from alembic.config import Config
import uvicorn

from app.core.config import Settings

ROOT = Path(__file__).resolve().parents[3]
TABLES = ("projects", "cycles", "workbooks", "transformation_findings", "upload_objects", "upload_errors")


def inspect_database(path: Path) -> dict:
    with sqlite3.connect(path.as_uri() + "?mode=ro", uri=True) as connection:
        connection.execute("PRAGMA query_only = ON")
        present = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        return {table: connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0] for table in TABLES if table in present}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--inspect", action="store_true")
    args = parser.parse_args()
    database = args.database.resolve()
    allowed = (ROOT / "data/outputs/browser-tests").resolve()
    if not database.is_relative_to(allowed) or database.name != "acceptance.sqlite3":
        parser.error("Refusing a database outside the test-owned output directory.")
    marker = database.parent / "ownership.json"
    if not marker.is_file() or json.loads(marker.read_text(encoding="utf-8")).get("runId") != args.run_id:
        parser.error("Missing or mismatched browser-test ownership marker.")
    if args.inspect:
        print(json.dumps(inspect_database(database)))
        return
    if database.exists():
        parser.error("Refusing to reuse an existing database, even in the test output directory.")

    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=f"sqlite+pysqlite:///{database.as_posix()}",
        cors_origins=["http://127.0.0.1:5174"],
    )
    # app.main also constructs an unused module-level app on import. Keep even
    # that app's lazy engine pointed at this owned path, never the normal DB.
    os.environ["TRACESYNC_DATABASE_URL"] = settings.database_url
    os.environ["TRACESYNC_ENVIRONMENT"] = "test"
    from app.main import create_app

    migration = Config(str(ROOT / "backend/alembic.ini"))
    migration.attributes["settings"] = settings
    command.upgrade(migration, "head")
    app = create_app(settings)

    @app.middleware("http")
    async def identify_owned_test_server(request, call_next):
        response = await call_next(request)
        response.headers["X-TraceSync-Test-Run"] = args.run_id
        response.headers["X-TraceSync-Test-Pid"] = str(os.getpid())
        return response

    print(f"Test API only: http://127.0.0.1:8001; database: {database}", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=8001, access_log=False)


if __name__ == "__main__":
    main()
