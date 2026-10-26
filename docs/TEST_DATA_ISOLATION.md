# TraceSync test data isolation

Investigated on 2026-10-26. No database or record that existed before this investigation was deleted or edited. Backend application code, frontend application code, business rules and the Projects page design were preserved.

## What the preview was using

The frontend at `http://127.0.0.1:5173` called `http://127.0.0.1:8000/api/v1`. That API was serving **`data/outputs/frontend-tooling/evidence-0.7/acceptance.db`**, rather than the normal workspace. All ten project UUIDs returned by the API exactly matched that database. The retained backend PID/startup logs corroborated the acceptance-server origin. Database inspection used read-only SQLite connections.

The earlier browser verification started a synthetic backend on the normal API port and left it running for visual review. Repeated live tests reused that persistent database and intentionally retained their synthetic records. The old test setup accepted an arbitrary API URL and relied on the operator to select a separate database and switch back afterward. No application startup seeding or frontend mock data caused the visible entries.

These were four separate pre-existing files, all on migration `0002_add_ingestion`:

| Database, relative to repository root | Projects | Cycles | Workbooks | Transformation rows | Upload objects | Upload messages |
|---|---:|---:|---:|---:|---:|---:|
| `data/local/tracesync.db` (normal) | 0 | 0 | 0 | 0 | 0 | 0 |
| `data/outputs/frontend-tooling/evidence-0.7/acceptance.db` | 10 | 13 | 14 | 141 | 21 | 28 |
| `data/outputs/frontend-tooling/projects-0.5/acceptance.db` | 2 | 2 | 0 | 0 | 0 | 0 |
| `data/outputs/frontend-tooling/uploads-0.6/acceptance.db` | 4 | 4 | 4 | 6 | 6 | 8 |

All four files were retained. Project names alone are not safe evidence for deletion; any real work performed in an acceptance database remains there too. The normal database was already empty before the preview was switched. Source hashes, counts and the UUID comparison are recorded locally in ignored `data/outputs/test-isolation-audit/`. Database hashes are checked again after verification.

The identified acceptance backend was stopped and the normal backend started on port 8000 using the existing normal database. The frontend URL remains the same. Reload Projects to discard the browser's previous in-memory list and workspace selection. There is no filtering or hiding of synthetic names in the UI.

## Start the normal application

Use two PowerShell terminals, each initially opened at the repository root. These are launch commands for an already installed checkout. For a fresh clone, first follow [backend installation](../backend/README.md) and [frontend installation](../frontend/README.md): Python 3.12, Node 24, the backend virtual environment and locked npm dependencies are required. Stop an existing server with Ctrl+C in its owning terminal before starting another on the same port; do not stop unrelated processes by port.

Terminal 1:

```powershell
$env:TRACESYNC_ENVIRONMENT = 'local'
$env:TRACESYNC_DATABASE_URL = 'sqlite+pysqlite:///data/local/tracesync.db'
& .\backend\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
& .\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload --no-access-log
```

Terminal 2, with Node 24 selected:

```powershell
$env:VITE_API_BASE_URL = 'http://127.0.0.1:8000/api/v1'
Set-Location frontend
npm.cmd run dev
```

On the existing development laptop only, this optional prefix selects its already downloaded Node 24 instead of the global Node 18. Run it at the repository root before Terminal 2's commands:

```powershell
$traceSyncNodeDirectory = (Resolve-Path 'data/outputs/frontend-tooling/node-v24.22.1-win-x64').Path
$env:Path = $traceSyncNodeDirectory + ';' + $env:Path
node --version
```

That ignored runtime is not required by the source and is not present in a fresh clone. Install/select Node 24 on another laptop. Open **http://127.0.0.1:5173/projects**. The explicit environment assignments above override stale shell or `.env` database/API targets. They do not copy, delete or seed data.

Optional read-only check in another terminal:

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/projects' | ConvertTo-Json -Depth 4
```

Immediately after this investigation the normal API returned `total: 0`, consistent with its pre-existing empty database. Real projects created afterward will appear normally.

## Automated test ownership

Backend pytest already creates migrated SQLite databases under pytest's per-test `tmp_path`, clears inherited `TRACESYNC_*` settings and disables `.env` loading for its test settings. No backend changes were necessary.

Frontend browser tests now run through a shared launcher:

| Command from `frontend/` | Frontend | API/data |
|---|---|---|
| `npm.cmd run test:browser -- --workers=2` | Owned Vite on 5174 | Mocked requests only; no backend or database; three live tests skipped |
| `npm.cmd run test:browser:live -- --workers=2` | Owned Vite on 5174 | Owned FastAPI on 8001, a newly migrated database for this run, synthetic XLSX inputs |
| `npm.cmd run test:isolation` | None | Checks cleanup ownership, mismatched markers and unexpected-file preservation using new disposable fixtures |

Install Playwright Chromium once with `npx.cmd playwright install chromium`, or set `$env:TRACESYNC_BROWSER_CHANNEL = 'msedge'` to use installed Microsoft Edge. Live tests require the installed backend Python environment; `TRACESYNC_TEST_PYTHON` optionally selects another environment. Remove obsolete manual API targets with `Remove-Item Env:TRACESYNC_LIVE_API_URL -ErrorAction SilentlyContinue`.

The launcher refuses occupied test ports, never reuses an existing API/frontend and rejects arbitrary API targets. It creates a unique directory and ownership marker under ignored `data/outputs/browser-tests/`. The test-only backend ignores normal configuration, refuses an existing database, runs Alembic and identifies itself with a per-run token. Fixtures verify this identity before live test writes; browser/API request guards block the normal API. Controlled tests block all unmocked API traffic. Playwright's config also requires the launcher, preventing accidental direct invocation without lifecycle management.

After success, failure or handled interruption, the launcher stops its directly owned processes, inventories its own database and reports what will be removed. It validates the resolved directory, marker and every file before deleting only that run's database, known SQLite sidecars and ownership marker, then removes the empty directory. It never recursively deletes, searches by project name or removes a pre-existing database. Summary JSON, screenshots and generated synthetic input workbooks remain ignored artifacts; they cannot populate the normal API.

An ownership mismatch, unexpected file or cleanup failure preserves the affected run and returns failure. Forced termination, an OS crash or power loss can leave temporary files; they are never reused or swept automatically. Inspect such files before any manual removal. Existing milestone acceptance databases remain preserved for inspection and are not cleanup targets.

## Verification

- Live browser suite: 19 passed, including actual project/cycle creation, synthetic imports and paginated evidence retrieval. Its new database was automatically discarded with 3 projects, 4 cycles, 4 workbooks, 36 transformation rows, 6 upload objects and 8 upload messages.
- Controlled browser suite: 16 passed, with the three live tests intentionally skipped; no backend/database used and the owned frontend stopped automatically.
- Cleanup ownership checks: 3 passed, including preservation on mismatched ownership and unexpected files.
- Frontend unit/component suite: 95 passed, including six API-target isolation checks.
- Backend regression: 67 passed; one confidential-workbook test intentionally skipped. The existing upstream TestClient deprecation warning remains.
- Failure-path probe: deliberately selecting no matching tests returned exit code 1, stopped both owned servers and discarded its newly migrated empty database; its summary recorded `cleaned: true`. A manual target pointing at the normal API was rejected before any run/database was created.
- ESLint, TypeScript checking and production build passed. Git ignore checks covered all four retained databases, new test databases and run summaries.
- All four pre-existing databases retained identical SHA-256 hashes and table counts. All 98 protected backend/application/source-workbook files retained identical hashes.
- A read-only real-browser visit to the normal Projects screen displayed “No projects yet” and issued no writes. The normal API returned zero projects. The ignored screenshot is `data/outputs/test-isolation-audit/normal-projects.png`.

The first verification attempt exposed a Windows process-tree shutdown hang after its test assertions passed. That newly created run was inventoried and discarded only after its owned processes were stopped. The launcher now owns direct Vite processes and verifies the owned Python server identity before shutdown; the subsequent complete live run exited and cleaned automatically. Existing normal preview processes and pre-existing databases were excluded.

No dependency, database migration, production endpoint or application feature was added. No commit or push was made. This check does not perform reconciliation or begin another screen.
