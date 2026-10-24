import os
from pathlib import Path
import shutil
import subprocess
import sys
import textwrap


def test_fresh_source_copy_migrates_and_ingests_offline_without_existing_local_state(tmp_path):
    repository = Path(__file__).resolve().parents[3]
    clone = tmp_path / "Fresh clone with spaces"
    backend = clone / "backend"
    backend.mkdir(parents=True)
    ignore = shutil.ignore_patterns("__pycache__", "*.pyc")
    shutil.copytree(repository / "backend/app", backend / "app", ignore=ignore)
    shutil.copytree(repository / "backend/alembic", backend / "alembic", ignore=ignore)
    for filename in ("alembic.ini", "pyproject.toml", "requirements-dev.lock"):
        shutil.copy2(repository / "backend" / filename, backend / filename)
    shutil.copy2(repository / ".env.example", clone / ".env.example")
    script = textwrap.dedent('''
        from pathlib import Path
        import sys
        sys.path.insert(0, str(Path.cwd() / "backend"))
        def offline(event, args):
            if event == "socket.getaddrinfo" and args[0] not in {"localhost", "127.0.0.1", "::1"}:
                raise RuntimeError("Outbound network disabled during portability check")
            if event == "socket.connect" and isinstance(args[1], tuple) and args[1][0] not in {"localhost", "127.0.0.1", "::1"}:
                raise RuntimeError("Outbound network disabled during portability check")
        sys.addaudithook(offline)
        from alembic import command
        from alembic.config import Config
        from fastapi.testclient import TestClient
        from app.core.config import REPOSITORY_ROOT, Settings
        from app.main import create_app
        from app.scripts.generate_demo_workbooks import transformation_bytes, post_upload_bytes
        assert REPOSITORY_ROOT == Path.cwd()
        assert not (Path.cwd() / "data").exists()
        assert not (Path.cwd() / "backend/.venv").exists()
        assert not (Path.cwd() / ".env").exists()
        settings = Settings(_env_file=None)
        config = Config(str(Path.cwd() / "backend/alembic.ini"))
        config.attributes["settings"] = settings
        config.attributes["configure_logger"] = False
        command.upgrade(config, "head")
        with TestClient(create_app(settings)) as client:
            project = client.post("/api/v1/projects", json={"name": "Portable synthetic project"}).json()
            cycle = client.post("/api/v1/projects/" + project["id"] + "/cycles", json={"name": "Portable cycle"}).json()
            for role, content, expected in [
                ("transformation", transformation_bytes(), {"Detailed_LOG": 3}),
                ("post_upload", post_upload_bytes(), {"Objects": 3, "Errors": 4}),
            ]:
                response = client.post("/api/v1/cycles/" + cycle["id"] + "/workbooks", data={"role": role}, files={"file": ("fictional.xlsx", content)})
                assert response.status_code == 201
                assert response.json()["workbook"]["row_counts"] == expected
            assert client.get("/api/v1/ready").status_code == 200
        assert (Path.cwd() / "data/local/tracesync.db").is_file()
        print("Fresh-source offline ingestion verified")
    ''')
    environment = {key: value for key, value in os.environ.items() if not key.upper().startswith("TRACESYNC_")}
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    result = subprocess.run(
        [sys.executable, "-c", script], cwd=clone, env=environment,
        capture_output=True, text=True, timeout=45,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Fresh-source offline ingestion verified" in result.stdout
