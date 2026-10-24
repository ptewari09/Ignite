# TraceSync

TraceSync helps transformation leads compare an initial transformation report with a post-upload report, inspect the supporting messages, and prepare a reviewed customer Excel report. Today this involves manually mapping objects and errors between spreadsheets. The intended application preserves that evidence while reducing repetitive copying and comparison.

**Current stage: Prompt 0.2 — backend foundation, completed on 2026-10-24.** Prompt 0.1 workbook discovery is preserved. The backend now provides `TraceSync API`, health/readiness endpoints, validated settings, request metadata logging, consistent errors, SQLAlchemy sessions and one Alembic migration for `Project`. Workbook ingestion, reconciliation, UI, export and AI are not implemented.

## Intended workflow

Upload two source workbooks → validate their layouts → associate objects and messages → review findings → approve customer entries → export Excel.

The user defines `Out of scope` as an object absent from the TR shared with Smartshift, which the company currently cannot see or access in this workflow. These objects must reach the customer for revalidation and a decision on access before the second run. They remain part of the reviewed reporting workflow. See BR-001 and BR-002 in [Business rules](docs/mapping-rules.md) for the confirmed requirements and open process details.

The existing customer workbook is a format/evaluation reference. Ordinary processing will use the two source workbooks. Matching the same object does not establish that its errors match or that remediation succeeded. Smart Blocker Radar will later suggest shared blockers only when actual messages support a shared identifier.

## Proposed technology

| Area | Technology | Purpose |
|---|---|---|
| Browser interface | React, TypeScript, Vite | Upload files, inspect evidence and review findings |
| Styling | Tailwind CSS | Consistent, readable forms and tables |
| Backend | Python 3.12+, FastAPI, Pydantic v2 | Validate requests and run local processing |
| Excel | OpenPyXL; pandas when useful | Read workbooks and later generate `.xlsx` reports |
| Storage | SQLite, SQLAlchemy 2, Alembic | Save projects, cycles, original records and reviewer history |
| Verification | pytest/httpx; Vitest/React Testing Library | Check processing, API and important UI behavior |
| Later options | Docker Compose; PostgreSQL; approved AI provider | Reproducible demo, shared deployment, optional explanations |

Python, FastAPI/Uvicorn, Pydantic/Pydantic Settings, SQLAlchemy/Alembic, SQLite, OpenPyXL/pandas and Pytest/HTTPX are installed in the backend's isolated environment. Frontend and later deployment/AI choices remain proposed. Discovery used the previously available Python/OpenPyXL; no customer workbook was uploaded externally. The implemented foundation works locally.

## Repository layout

```text
backend/
  pyproject.toml
  requirements-dev.lock
  alembic.ini
  alembic/        # explicit schema migrations
  app/
    main.py       # TraceSync API application factory and entry point
    core/         # settings, exception handlers and request logging
    api/          # /api/v1/health and /api/v1/ready
    db/           # engine, sessions, base and Project model
    schemas/      # health/readiness response contracts
    services/     # future processing logic
    scripts/      # read-only workbook inspection utility
  tests/
    fixtures/     # reserved for future synthetic test inputs
    unit/
    integration/
frontend/
  src/{api,components,pages,types}/  # reserved folders; no UI yet
  tests/
docs/
  Project_Reference.md
  DATA_DICTIONARY.md
  RECONCILIATION_DISCOVERY.md
  IMPLEMENTATION_PLAN.md
  BEGINNER_GUIDE.md
  mapping-rules.md
  SENIOR_QUESTIONS.md
data/
  README.md
  sample_files/   # existing internal workbooks; ignored by Git
  outputs/        # local inspection results; ignored by Git
```

`.gitkeep` files allow Git to retain otherwise empty folders. The repository already existed; it was preserved. No commit was made.

## Run the local inspector

Original discovery used Python 3.12.4 and OpenPyXL 3.1.2. The isolated backend environment now uses OpenPyXL 3.1.5. After the [backend setup](backend/README.md), run from the repository root in PowerShell:

```powershell
& .\backend\.venv\Scripts\python.exe backend/app/scripts/inspect_workbooks.py `
  "data/sample_files/Zf_LE1_Transformation_Check_Objects_Error_LOG.XLSX" `
  "data/sample_files/Upload errors.xlsx" `
  "data/sample_files/ZF_LE1_Upload_Errors.xlsx" `
  --output "data/outputs/workbook_profile.json"
```

From `backend/`, the equivalent module is `python -m app.scripts.inspect_workbooks`, using paths relative to that directory and the backend environment's Python. The existing inspector remains independent of the API; it does not ingest records into the database.

The utility assumes the inspected tabular sheets use row 1 for headers. It reports every sheet, field types, missing values, category frequencies, duplicate-name row locations, formatting issues and five sanitized sample records per populated sheet. It masks object identifiers and free text. Output still contains internal metadata and belongs in ignored local storage. It checks source SHA-256 hashes before/after reading and never saves a source workbook.

## Documentation and next step

- [Data dictionary](docs/DATA_DICTIONARY.md): exact source columns, row counts and export-reference layouts.
- [Reconciliation discovery](docs/RECONCILIATION_DISCOVERY.md): candidate keys, evidence examples, limitations and open business questions.
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md): small milestones and acceptance checks.
- [Beginner guide](docs/BEGINNER_GUIDE.md): concepts, technology choices and a panel explanation.
- [Business rules](docs/mapping-rules.md): dated user-confirmed guidance and remaining interpretation limits.
- [Questions for seniors](docs/SENIOR_QUESTIONS.md): current priorities and a question list for each build stage.
- [Original project reference](docs/Project_Reference.md): broader proposed specification; unchanged.
- [Backend setup](backend/README.md): exact PowerShell install, migration, server and test commands; verified Prompt 0.2 results.

Next is a separately authorized ingestion task using the verified layouts. Message-block linkage and unresolved report rules remain visible questions; they do not prevent preserving source rows. Prompt 0.2 stops before ingestion.

## Local data and Git

Keep internal data under `data/`. `.gitignore` excludes local data, Excel files, logs, environment variables, common credential files, databases and generated output. `data/README.md` is the only allowed tracked file under `data/`. Ignore rules do not untrack files already committed or detect secrets embedded in source code; review changes before committing. Discovery verified that no supplied workbook is tracked.

Original workbooks remain in `data/sample_files/`; the reference's `data/samples/` path does not exist in this checkout. Workbooks were read locally without external API calls or modifications.
