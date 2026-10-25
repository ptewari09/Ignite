# TraceSync

TraceSync helps transformation leads compare an initial transformation report with a post-upload report, inspect the supporting messages, and prepare a reviewed customer Excel report. Today this involves manually mapping objects and errors between spreadsheets. The intended application preserves that evidence while reducing repetitive copying and comparison.

**Current stage: Prompt 0.5 — functional Projects and Upload Cycles.** The frontend now lists/creates projects and their cycles through the existing FastAPI API, with shared workspace selection across routes. The responsive shell, compact Overview, educational guide and blue/white/red-violet design system are preserved. The backend manages projects/cycles, ingests both source roles transactionally and returns paginated evidence with provenance. Upload UI, evidence tables, reconciliation, customer export and AI remain future work.

## Intended workflow

Upload two source workbooks → validate their layouts → associate objects and messages → review findings → approve customer entries → export Excel.

The user defines `Out of scope` as an object absent from the TR shared with the transformation team, which currently cannot see or access that object in this workflow. These objects must reach the customer for revalidation and a decision on access before the second run. They remain part of the reviewed reporting workflow. See BR-001 and BR-002 in [Business rules](docs/mapping-rules.md) for the confirmed requirements and open process details.

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

Backend dependencies remain in their isolated environment. The frontend now declares React, TypeScript, Vite, Tailwind CSS, React Router, Lucide and focused test tools, with an npm lockfile. No customer workbook was uploaded externally. The installed ingestion backend and frontend shell work locally without internet; later deployment/AI choices remain proposed.

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
    api/          # health, projects, cycles, workbook upload and evidence retrieval
    db/           # engine, sessions, projects/cycles and source-evidence tables
    schemas/      # validated API request/response contracts
    services/     # separate parsers, normalization and transactional persistence
    scripts/      # inspection utility and fictional demo workbook generator
  tests/
    fixtures/     # synthetic workbook/API test helpers
    unit/
    integration/
frontend/
  package.json / package-lock.json
  src/{layouts,components,contexts,pages,services,types,styles}/
  tests/         # component/API-client and real-browser navigation checks
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
  local/          # configurable local database; ignored by Git
  demo/           # generated fictional workbooks; ignored by Git
  outputs/        # local inspection/verification output; ignored by Git
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
- [Backend setup](backend/README.md): fresh-clone Windows prerequisites, installation/migrations, synthetic ingestion walkthrough, endpoint contract and verified Prompt 0.3 results.
- [Frontend setup](frontend/README.md): Node 24 prerequisites, exact two-terminal Windows backend/frontend commands, project/cycle workflow and controlled/live browser checks.

Default backend tests use fictional workbooks and fresh temporary databases. Frontend component and controlled browser tests need no company data or backend. An opt-in live browser test verifies actual FastAPI HTTP requests using fictional projects/cycles in an isolated migrated database. See the frontend README for setup and results. Development proceeds one screen at a time; Prompt 0.5 stops at Projects/Cycles for visual and functional review. Message-block linkage, scope evidence and unresolved report rules remain review questions for later reconciliation work.

## Local data and Git

Keep internal data under `data/`. `.gitignore` excludes local data, Excel files, logs, environment variables, common credential files, databases and generated output. `data/README.md` is the only allowed tracked file under `data/`. Ignore rules do not untrack files already committed or detect secrets embedded in source code; review changes before committing. Discovery verified that no supplied workbook is tracked.

Original workbooks remain in `data/sample_files/`; the reference's `data/samples/` path does not exist in this checkout. Workbooks were read locally without external API calls or modifications.
