# TraceSync frontend

Prompt 0.7 adds the functional **Evidence Explorer** to the existing Projects/Cycles and Upload Reports workflow. Select a workspace, import its source workbooks, then inspect paginated transformation findings, upload objects and technical messages with original provenance. The five navigation entries, compact Overview, educational guide and design system are preserved. Customer Reports and the two hidden future routes remain placeholders. Reconciliation, approvals, reporting, authentication and AI remain future work.

Prompt 0.4A.2 applies the shared blue, white and red-violet palette to that existing interface. It changes presentation only, with no new dependencies or changes to routes, onboarding behavior or the API client.

## Windows prerequisites

Install Git and **64-bit Node.js 24 LTS, version 24.15.0 or later within Node 24**, with npm **11 or 12**. Tested versions: Node **24.22.1**, npm **11.19.1**. `.nvmrc` records that Node version for compatible version managers. Download Node from the [official website](https://nodejs.org/en/download), then open a new PowerShell terminal.

```powershell
node --version
npm.cmd --version
```

If Node 18 or 22 is reported, switch to Node 24 before installing. The current stable router and DOM test environment require a newer runtime than the original laptop's default Node 18. This project does not change global Node/npm installations. PowerShell 5.1+ works; `npm.cmd` avoids execution-policy restrictions on `npm.ps1`. Projects, Upload Reports and Evidence Explorer also need **Python 3.12** and local FastAPI, as described below. Excel and Docker are unnecessary. Overview and placeholders render without a backend; functional screens show recoverable errors if the API is unavailable.

## Install and start after cloning

From the repository root, with the supported runtime selected:

```powershell
Set-Location frontend
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Frontend installation failed.' }

# Install isolated developer lint tools. App-only demos can omit this command.
npm.cmd ci --prefix tools/lint
if ($LASTEXITCODE -ne 0) { throw 'Lint tooling installation failed.' }

# Optional: defaults also work without a local env file.
if (-not (Test-Path -LiteralPath '.env.local')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
}
npm.cmd run dev
```

Open **http://127.0.0.1:5173/**. Vite redirects the app root to `/overview`, binds to loopback and uses a strict port. An occupied port produces an error rather than selecting a port outside backend CORS defaults. Leave this terminal running; use another terminal for commands. Press **Ctrl+C** to stop it. The backend also permits the `http://localhost:5173` frontend origin.

Use `npm ci` on another laptop to reproduce the application lockfile and `npm ci --prefix tools/lint` to reproduce the lint-tool lockfile. Do not transfer either `node_modules` directory, local `.env` files, databases or company workbooks. No commit or push is made by this milestone; include both manifests/lockfiles and source in your own reviewed commit before cloning elsewhere.

Installation initially needs npm-registry access. Installed assets use system fonts and bundled icons, without remote fonts or CDNs. Projects calls the local API; no external service or runtime internet connection is needed after dependencies are installed. No Docker or setup/deployment infrastructure was added.

## Run backend and frontend together

Use **two separate PowerShell terminals**, both initially opened in the clone root. These commands work with repository-relative paths and a newly created database. They need no confidential workbooks. First install/select Python 3.12 and Node 24 as documented here and in [backend setup](../backend/README.md).

**Terminal 1: FastAPI.** Install dependencies on first setup, then apply the existing migrations before starting the API:

```powershell
if (-not (Test-Path -LiteralPath 'backend/.venv/Scripts/python.exe')) {
    py -3.12 -m venv backend/.venv
}
& .\backend\.venv\Scripts\python.exe -m pip install -c backend/requirements-dev.lock -e './backend[dev]'
if ($LASTEXITCODE -ne 0) { throw 'Backend installation failed.' }
if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
}
# Explicitly select the normal workspace, overriding leftover test settings.
$env:TRACESYNC_ENVIRONMENT = 'local'
$env:TRACESYNC_DATABASE_URL = 'sqlite+pysqlite:///data/local/tracesync.db'
& .\backend\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
& .\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload --no-access-log
```

**Terminal 2: React.** Install dependencies on first setup, then start Vite:

```powershell
$env:VITE_API_BASE_URL = 'http://127.0.0.1:8000/api/v1'
Set-Location frontend
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Frontend installation failed.' }
npm.cmd ci --prefix tools/lint
if ($LASTEXITCODE -ne 0) { throw 'Lint tooling installation failed.' }
if (-not (Test-Path -LiteralPath '.env.local')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
}
npm.cmd run dev
```

Open **http://127.0.0.1:5173/projects**, select a project and cycle, then open **Upload Reports** to import files and **Evidence Explorer** to browse their source rows. The default API URL is `http://127.0.0.1:8000/api/v1`; frontend `.env.local` can override `VITE_API_BASE_URL`. Backend CORS already permits `http://127.0.0.1:5173` and `http://localhost:5173`. No backend change is required. Leave both server terminals running; use another terminal for tests. Press **Ctrl+C** in a server terminal to regain its command prompt. Later launches can omit installation; keep migrations current before starting FastAPI.

The normal database is the configurable, ignored `data/local/tracesync.db`. Alembic creates a fresh schema; the API never creates tables or seeds projects at startup. No existing database, virtual environment, confidential workbook or machine-specific folder is required after cloning and installing dependencies. Browser acceptance tests now use different ports and disposable databases; see [Test data isolation](../docs/TEST_DATA_ISOLATION.md) for the investigation and normal launch commands.

### Existing development-laptop runtime

The visual verification used an official, SHA-256-verified portable Node 24 runtime under ignored local data, because this laptop defaults to Node 18. Global Node installations were left unchanged. To reuse that already-downloaded runtime, run this from the repository root before the frontend commands:

```powershell
$traceSyncNodeDirectory = (Resolve-Path 'data/outputs/frontend-tooling/node-v24.22.1-win-x64').Path
$env:Path = $traceSyncNodeDirectory + ';' + $env:Path
node --version
```

This is optional local tooling and is not present in a fresh clone. On another laptop, install/select Node 24 as described above. The application source and configuration never depend on that local folder. A development preview left running on port 5173 must be stopped before another server can use the same port.

## Test and build commands

From `frontend/`:

```powershell
# Unit/component checks, once; no browser download required.
npm.cmd test

# Optional interactive test watcher.
npm.cmd run test:watch

# TypeScript checks without emitted files.
npm.cmd run typecheck

# ESLint, including TypeScript and React Hooks rules; zero warnings allowed.
npm.cmd run lint

# Includes TypeScript checks and writes dist/.
npm.cmd run build

# Serve the production build at http://127.0.0.1:4173/.
npm.cmd run preview
```

For backend regression verification, from the repository root:

```powershell
& .\backend\.venv\Scripts\python.exe -m pytest -c backend/pyproject.toml backend/tests -q
```

The application still uses TypeScript **7.0.2**. ESLint **10.13.0**, React Hooks rules **7.1.1** and typescript-eslint **8.72.0** live in an isolated private package under `tools/lint`, with their own lockfile and supported TypeScript **6.0.3** parser dependency. This avoids forcing unsupported peers or downgrading the application compiler: typescript-eslint 8.72 supports TypeScript versions below 6.1 ([upstream compatibility](https://typescript-eslint.io/users/dependency-versions/)). The parser's compiler is only used for lint analysis; `npm run typecheck` and `npm run build` use the application's TypeScript 7. The lint configuration is a standard [ESLint flat configuration](https://eslint.org/docs/latest/use/configure/configuration-files).

Vitest now caps DOM test workers at **2** in `vitest.config.ts` to keep the larger suite reproducible on demo laptops. The normal `npm.cmd test` command uses that cap without extra flags. Tests remain isolated per file; no timeouts or lint rules were relaxed.

Vite supports direct-link SPA history fallback. Deploying `dist/` later will require the host to return `index.html` for application routes; deployment remains outside this milestone.

## Real-browser verification

Playwright tests render desktop/mobile navigation, visible/hidden routes, reloads, focus management, skip navigation and responsive layouts. They cover onboarding, Projects/Cycles, uploads, safe retries, evidence tabs/pagination/details, current-page filtering and stale-response protection. Controlled tests intercept fictional responses and do not verify FastAPI integration. The guide alone still makes no API requests. Choose one browser setup from `frontend/`:

```powershell
# Portable: download Playwright's matching Chromium once.
npx.cmd playwright install chromium
npm.cmd run test:browser
```

Or use an existing Microsoft Edge installation on Windows:

```powershell
$env:TRACESYNC_BROWSER_CHANNEL = 'msedge'
npm.cmd run test:browser
Remove-Item Env:TRACESYNC_BROWSER_CHANNEL
```

The test launcher starts its own Vite on **127.0.0.1:5174** and stops it afterward. It never reuses or stops the normal preview on port 5173. Controlled tests require mocked API responses; unmocked requests are blocked. The three live tests are skipped by this command. Screenshots/failure traces go in ignored `frontend/test-results/`. Browser installation initially needs internet; the installed browser can test the shell offline.

### Optional real FastAPI browser test

`projects-live.spec.ts`, `uploads-live.spec.ts` and `evidence-live.spec.ts` make real browser HTTP requests and create fictional records. Run them through the owner-aware launcher below, from `frontend/` with Node 24 selected. The normal application can stay running on ports 8000/5173. Both test ports **8001 and 5174 must be free**; an occupied test port causes refusal, never server reuse or termination.

```powershell
# Remove the old manual target if it remains in this terminal.
Remove-Item Env:TRACESYNC_LIVE_API_URL -ErrorAction SilentlyContinue
$env:TRACESYNC_BROWSER_CHANNEL = 'msedge'
npm.cmd run test:browser:live -- --workers=2
Remove-Item Env:TRACESYNC_BROWSER_CHANNEL

# Focused checks of cleanup ownership and refusal to delete unknown files.
npm.cmd run test:isolation
```

The launcher creates a uniquely marked directory under ignored `data/outputs/browser-tests/`, migrates a **new** SQLite database, starts its own FastAPI on port 8001 and Vite on port 5174, and verifies a per-run identity token before allowing test writes. It ignores normal database/env-file settings and rejects arbitrary API targets, including port 8000. Python is located in `backend/.venv` (Windows or POSIX layout); set `TRACESYNC_TEST_PYTHON` only for another installed backend environment. No production backend code or endpoint is changed.

On success, failure or a handled interruption, the launcher stops its owned servers, reports record counts and discards only that run's verified database and SQLite sidecars. Existing databases are never cleaned by project name or a file glob. An ownership mismatch or unexpected file preserves the run for inspection and fails cleanup. A forced process termination or power loss can also leave an owned run behind; it is never reused automatically. Ignored JSON summaries remain outside the discarded directory. Upload/evidence tests generate synthetic XLSX inputs under ignored output; no company workbooks are used. Tests verify creation, ingestion, CORS, validation, duplicates/conflicts and evidence pagination. Run Playwright through these npm scripts so setup and teardown cannot be bypassed accidentally.

## Routes, design and accessibility

| Route | Screen |
|---|---|
| `/` | Redirect to `/overview` |
| `/overview` | Compact welcome, interactive guide, no-project empty state and review workflow |
| `/projects` | Functional project directory, creation forms, cycle listing/creation and workspace selection |
| `/upload-reports` | Functional transformation/post-upload workbook imports and saved import metadata |
| `/evidence` | Read-only transformation findings, upload objects and upload errors with pagination and record details |
| `/reconciliation` | Hidden future route; direct-link placeholder |
| `/blocker-radar` | Hidden future route; direct-link placeholder |
| `/customer-reports` | Customer Reports placeholder |
| Unknown paths | Page-not-found state with an Overview link |

Below 1024px the desktop sidebar becomes a native modal drawer. Its background is inert; explicit Tab/Shift+Tab wrapping retains focus. Escape, backdrop, close button, navigation and resizing to desktop close it. Real links expose `aria-current`; document/header titles follow the route; route changes focus main content. Skip navigation, visible focus indicators and reduced-motion support are included.

Semantic color, shadow and font tokens live in `src/styles/tokens.css`; Tailwind presentation rules live in `src/styles/app.css`. The palette uses navy navigation, white and pale-blue surfaces, blue actions, restrained red-violet onboarding accents, teal success, amber warning and red error. No projects, counts, reconciliation results or connection status are fabricated.

Visible navigation is Overview, Projects, Upload Reports, Evidence Explorer and Customer Reports. The old sidebar signoff and decorative arrow were removed. Reconciliation/Radar plans and routes remain intact.

## Global palette

All component colors come from the centralized tokens below. Names in the table omit the `--color-` prefix. The browser chrome `theme-color` in `index.html` mirrors the navy sidebar.

| Token(s) | Value | Use |
|---|---|---|
| `canvas` | `#F4F7FD` | Workspace background |
| `surface`, `sidebar-heading` | `#FFFFFF` | Cards, header and sidebar headings |
| `ink`, `sidebar` | `#122544` | Primary text and navigation background |
| `muted` | `#526581` | Secondary text |
| `subtle` | `#5D6F89` | Supporting text |
| `primary` | `#2563EB` | Primary actions and selected step numbers |
| `primary-hover`, `focus` | `#1D4ED8` | Action hover, keyboard focus and text on ice blue |
| `primary-soft` | `#EFF5FF` | Subtle blue surfaces and hover backgrounds |
| `primary-line`, `brand-accent` | `#DBEAFE` | Ice-blue selection, borders and brand detail |
| `accent` | `#A12B85` | Guide icon, step caption and progress fill |
| `accent-soft` | `#FBF0F8` | Guide icon background |
| `line` | `#DCE5F2` | Subtle dividers |
| `line-strong` | `#CAD8EB` | Stronger decorative borders |
| `control-line` | `#7488A6` | Visible outlined controls and step circles |
| `sidebar-line` | `#2C4A73` | Sidebar borders |
| `sidebar-text` | `#CDDBEF` | Sidebar navigation text |
| `sidebar-muted` | `#A1B4D0` | Sidebar supporting text |
| `sidebar-active` | `#203F6B` | Active navigation |
| `sidebar-hover` | `#1B3558` | Navigation hover |
| `success` / `success-soft` | `#147D68` / `#EDF8F4` | Success, unchanged |
| `warning` / `warning-soft` | `#94610C` / `#FFF7E7` | Warning, unchanged |
| `danger` / `danger-soft` | `#C23943` / `#FFF0F1` | Error, unchanged |
| `backdrop` | `#12254480` | Mobile navigation backdrop |

`--shadow-panel` uses two subtle navy shadows: `0 2px 5px #12254405, 0 8px 24px #12254405`. The existing system font stack, spacing, breakpoints and reduced-motion behavior are retained. Primary blue remains the action color; red-violet is reserved for guide highlights and never represents an error.

Small text on ice blue uses the darker `primary-hover` token: its contrast is approximately **5.49:1**, compared with **4.24:1** for primary blue on the same background. This pairing supports the [WCAG normal-text contrast criterion](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Control borders are distinct from decorative dividers, and keyboard outlines use the dedicated `focus` token.

## Interactive onboarding

The reusable `GettingStartedGuide` explains four steps: **Create a project**, **Create an upload cycle**, **Upload source reports**, and **Explore evidence**. Next and Back move through explanations; numbered buttons allow direct selection. Skip collapses the guide, Reopen starts it from the first step, and Finish guide offers Restart. An accessible progress bar, live step announcements and focus restoration support keyboard use. Reduced-motion preferences apply to the progress transition.

Progress is explicitly labeled **Guide progress**. Reading a step never completes project work, creates a record or uploads a report. Workspace selection remains unchanged after finishing. All guide state stays in React memory; no localStorage, sessionStorage, backend or authentication is used. Reloading or leaving/revisiting Overview resets the guide. The View projects / Manage workspace link opens the functional Projects screen; the four-step educational content is unchanged.

## Projects and workspace selection

- Open Projects from the sidebar, Overview or header workspace link. Project lists show real names, descriptions when present and UTC creation dates. Refresh retrieves every page using the API's supported `limit`/`offset` contract.
- Choose **New project**, enter a required name (1–200 characters after trimming) and optional description (up to 4,000 characters), then create it. A successful response selects the new project. Select any existing project to view its upload cycles.
- Choose **New cycle** inside the selected project's panel. Only its required name is submitted. A successful response selects the cycle. **Use this cycle** selects an existing cycle. Ingestion status is displayed as supplied by the API; it is not review status or a completion percentage.
- A lightweight React Context shares fetched metadata and selected IDs across routes. Switching projects clears the cycle immediately. Only fetched project/cycle records or successful creation responses can be selected. Refresh clears selections absent from server results; a cycle-endpoint 404 invalidates its project. Delayed responses cannot select another project's cycle.
- Selection stays in React memory while navigating and resets on reload. Projects/cycles themselves persist in SQLite and are fetched again on Projects. The Overview remains a compact welcome with workspace context, not a functional analytics dashboard. Reading the guide does not select or create anything.
- Lists have loading, empty, error and retry states. Failed refreshes retain cached list rows with selection disabled until a successful retry. Forms retain input after an API failure, announce feedback and expose safe request IDs. Saving disables controls and guards repeated submits; POST requests are never automatically retried.

Forms are inline, labeled and keyboard accessible. Focus moves to the name field on opening and returns to the creation button on closing. Selection uses `aria-pressed` plus visible text, feedback uses live/status or alert regions, long names wrap in content, and the header truncates names while preserving its full accessible label/title. All new styles use the existing palette tokens and reduced-motion rules.

**Limits:** the backend allows repeated project/cycle names and has no create idempotency key. The submit guard prevents simultaneous accidental requests, not separate intentional creations. After a network interruption, refresh before trying again: a server may have saved the first request without its response reaching the browser. Lists currently load all pages into memory; server-side search/paging UI is deferred. Editing, deletion and cross-tab selection persistence remain unimplemented. Workbook ingestion is now available separately on Upload Reports.

## Upload Reports

1. Create/select a project and upload cycle on Projects, then open **Upload Reports**. Without both selections, the page shows instructions and disabled cards with a working Projects link. Saved workbook metadata is checked before uploads are enabled.
2. **Transformation Report** sends the `transformation` role. The current parser requires `Detailed_LOG` and row-1 headers `Status`, `Object Type`, `Object Name`, `Error Category`, `Message`, `Suggested Action`, `File Name`.
3. **Post-Upload Report** sends `post_upload`. `Objects` contains object results; `Errors` contains detailed technical messages, often multiple per object. Expand either card's structure guide for exact headers. The current `Objects` adapter requires both manual annotation columns, even when blank; they remain separate from tool status and approval. Required layouts come from the existing backend adapters, not sample filenames. `Summary` is optional; the customer-facing reference workbook is not an ingestion input.
4. Choose a file with the keyboard-accessible picker or drop one file on a card. The frontend checks one file, case-insensitive `.xlsx`, nonzero size and the configured byte limit. It shows the selected name/size and allows Change/Clear. It never parses XLSX contents in the browser. The server validates actual workbook readability, worksheets, columns, cells and processing limits.
5. Upload sends multipart `role` and `file` through the existing API client without manually setting Content-Type. Controls are disabled during a request, repeated submits are guarded, and progress is described as indeterminate upload/validation. No percentage is fabricated.
6. Saved details show role via its card, original filename, original import timestamp, byte size, server status, records per worksheet, distinct normalized names and warnings. Warning occurrence counts retain their API meaning; they are not automatically row counts or root-cause groups. No evidence tables or reconciliation are added.

**Saved state and last attempts are separate.** A new import is HTTP 201. Identical bytes return HTTP 200 with `duplicate: true`; original metadata/evidence is reused. Duplicate feedback stays in React memory only, while navigation back to the page fetches persisted imports. Different bytes for an occupied role return HTTP 409; the page rechecks saved metadata and never offers replacement. Use a new cycle for changed reports. Validation failures do not become saved imports. Network failures are explicitly unconfirmed, because the server may have committed before a response was lost. Refresh saved reports before retrying; POSTs are not automatically retried.

Changing/leaving the active cycle discards selected files and local result notices, cancels the browser request and prevents late responses from appearing in another workspace. Cancellation is not a promise of server rollback: return to the original cycle and refresh to check its saved state. Reload resets the existing in-memory workspace selection; reselecting the same cycle retrieves its saved reports again. The server never modifies the originals or persists uploaded workbook binaries. Selected browser files are held only for the pending selection/retry and released on Clear, success or leaving the workspace. No workbook contents are logged or stored in localStorage/sessionStorage.

### File limits and local synthetic demo

`VITE_MAX_UPLOAD_BYTES` defaults to **20971520 (20 MiB)**, matching `TRACESYNC_MAX_UPLOAD_BYTES` in the backend. No settings endpoint exists. If the backend limit is customized, set the same byte value in frontend `.env.local` and restart Vite. Invalid frontend values disable uploading and show a configuration error. The backend remains authoritative and may also reject a smaller compressed file for exceeding expanded-workbook or worksheet limits. HTTP 413, 415, 422, 409 and unavailable-backend responses have safe, accessible feedback and retain request IDs; unexpected source-bearing error text is not shown.

For fictional, portable demo inputs, run from the repository root after backend installation:

```powershell
& .\backend\.venv\Scripts\python.exe -m app.scripts.generate_demo_workbooks --output data/demo
```

Select `synthetic-transformation.xlsx` and `synthetic-post-upload.xlsx` from that output folder in their respective cards. Filenames are examples, not requirements. Expected generated source counts are **3 transformation findings, 3 upload objects and 4 upload messages**. The generator reads no confidential files and leaves existing outputs untouched. No additional application dependency, Excel installation, cloud service or backend modification is needed.

## Evidence Explorer

Open **http://127.0.0.1:5173/evidence** after selecting a project/cycle. The screen shows three accessible tabs: **Transformation Findings**, **Upload Objects** and **Upload Errors**. Arrow Left/Right and Home/End select tabs and move focus. The active tab remains visible in its horizontally scrollable strip on narrow screens and after resizing. A missing workspace links to Projects; a missing source role explains which workbook to import and links to Upload Reports. An imported workbook with zero records has a distinct empty state.

Only one server page of **25** records is loaded for the active dataset. Previous/Next use the backend's actual `offset`, `limit`, `items` and `total`. Page changes announce the server range, clear the page filter/detail selection and focus the dataset heading. Tab/cycle changes reset to the first page. Requests are canceled and their responses ignored after a tab/cycle change. **Refresh page** reloads the current page; **Refresh sources** rechecks the small workbook-metadata list and restarts the active dataset at its first page.

The backend has no search/filter parameters. **Filter current page** searches values in the loaded records only, including their raw payload values and normalized identifiers. It makes no search request and never changes server totals. Zero filtered matches do not establish that other pages have no matches. Global search remains deferred.

Tables preserve every record ID independently, including repeated object names. Columns stay available through horizontal scrolling; long messages wrap without losing their text. Source status tokens are displayed as data, without interpreting their business meaning. Missing values use an accessible dash; empty/whitespace-only strings remain distinguishable in record details. Normalized identities are supplied by the backend and are not recalculated or treated as matches in the browser.

Each **Inspect** button opens a read-only, responsive native-dialog drawer. It shows workbook filename/role, worksheet, original Excel row, record/workbook IDs, all dataset-specific fields, exact quoted raw strings, normalized identity in a separate section, and expandable JSON containing every original payload column. Tool output and imported manual annotations remain separate. Escape, Close or the backdrop dismiss the drawer; keyboard focus stays inside it and returns to the inspected record on closing. No evidence is edited, merged, classified or deduplicated.

| Dataset | Common table fields | Additional source fields available in table/details |
|---|---|---|
| Transformation Findings | Original type/name, worksheet, Excel row | `status_raw`, `error_category_raw`, `error_message_raw`, `suggested_action_raw`, `file_name_raw` |
| Upload Objects | Original type/name, worksheet, Excel row | `status_info_raw`, `tool_status_raw`, `re_upload_raw`, `manual_status_raw`, `manual_comments_raw` |
| Upload Errors | Original type/name, worksheet, Excel row | `info_raw`, `sequence_number`, `message_type_raw`, `message_raw` |

Details also expose `object_type_normalized`, `object_name_normalized`, `raw_payload`, `id` and `workbook_id`. `file_name_raw` is the original source column; workbook provenance comes from the imported workbook metadata. Technical messages with no object identity remain visible with their original row and message. Viewing a source suggested action or manual annotation does not turn it into an approved customer action.

## API configuration

`src/services/apiClient.ts` centralizes `VITE_API_BASE_URL`, defaulting to `http://127.0.0.1:8000/api/v1`. Vite reads frontend `.env.local`, independently of the backend's root `.env`. `VITE_MAX_UPLOAD_BYTES` configures client-side selection validation as described above. Restart Vite after environment changes.

The generic `request<T>` accepts API-relative paths, preserves caller headers and cancellation, expects JSON, and supports empty HTTP 204 responses. `ApiError` carries a safe message, HTTP status, code and request ID. It recognizes the backend's `{ error: { code, message }, request_id }` envelope, safely handles non-JSON/network failures and does not force multipart content types. Its behavior is unchanged. `workspaceApi.ts` adds only the four existing endpoints below; Projects fetches on entry/selection and explicit refresh. No automatic retry or browser-storage persistence is added.

| Method | Existing endpoint | Request / response |
|---|---|---|
| GET | `/api/v1/projects?limit=200&offset=…` | Page of `id`, `name`, `description`, `created_at`, `updated_at` |
| POST | `/api/v1/projects` | `{ name, description }` → saved project, HTTP 201 |
| GET | `/api/v1/projects/{project_id}/cycles?limit=200&offset=…` | Page of `id`, `project_id`, `name`, `created_at`, `ingestion_status` |
| POST | `/api/v1/projects/{project_id}/cycles` | `{ name }` → saved cycle, HTTP 201 |

Page envelopes contain `items`, `total`, `limit` and `offset`. The service follows all pages before publishing a list; canceled or older requests do not overwrite a newer selection. No customer fields, cycle progress or extra endpoints are inferred from the broader project specification.

`workbookApi.ts` adds only these existing endpoints:

| Method | Endpoint | Contract |
|---|---|---|
| GET | `/api/v1/cycles/{cycle_id}/workbooks?limit=200&offset=…` | Paginated `WorkbookResponse` metadata; all pages are followed |
| POST | `/api/v1/cycles/{cycle_id}/workbooks` | FormData `role`, `file` → `{ workbook, duplicate }`, HTTP 201 or 200 |

Workbook metadata supplies `id`, `cycle_id`, `role`, `original_filename`, `sha256`, `byte_size`, `uploaded_at`, `ingestion_status`, `sheets_found`, `row_counts`, `object_counts`, `warnings`. Each warning supplies `code`, `message`, `worksheet_name`, `count`. Record counts already exist here; the upload UI does not fetch evidence rows for presentation or add endpoints. Response identities are checked against the target cycle/role.

`evidenceApi.ts` integrates only these existing read endpoints:

| Method | Endpoint |
|---|---|
| GET | `/api/v1/cycles/{cycle_id}/transformation-findings?limit=25&offset=…` |
| GET | `/api/v1/cycles/{cycle_id}/upload-objects?limit=25&offset=…` |
| GET | `/api/v1/cycles/{cycle_id}/upload-errors?limit=25&offset=…` |

The existing workbook-list endpoint supplies filename/role provenance and identifies missing imports; there are at most two workbook roles per cycle. Evidence responses are checked for the requested page and workbook ID before rendering. Errors show safe messages and request IDs, without logging or echoing unexpected source-bearing server text. No new backend API or search parameter was added.

All `VITE_*` values are public browser configuration. Never put tokens, passwords, workbook contents or secrets in them. `.env.example` is safe to track; local env files, dependencies, build output and browser artifacts remain ignored. Existing backend CORS settings support this frontend without backend changes.

## Structure and versions

```text
frontend/
  .env.example / .nvmrc
  package.json / package-lock.json
  index.html / tsconfig.json
  vite.config.ts / vitest.config.ts / playwright.config.ts
  src/
    main.tsx / App.tsx
    layouts/       # shared shell
    components/    # brand, navigation, onboarding, projects, uploads, evidence table/detail/fields
    contexts/      # in-memory workspace, fetched metadata and request lifecycle
    pages/         # Overview, Projects, Upload Reports, Evidence Explorer, placeholder, not-found
    services/      # existing generic API client + workspace/workbook/evidence endpoints
    types/         # backend error-envelope, workspace, workbook and evidence contracts
    styles/        # tokens and Tailwind rules
  tests/
    setup.ts / App.test.tsx / GettingStartedGuide.test.tsx / apiClient.test.ts
    ProjectsPage.test.tsx / workspaceApi.test.ts / fixtures/workspace.ts
    UploadReportsPage.test.tsx / workbookApi.test.ts / fixtures/workbooks.ts
    EvidenceExplorerPage.test.tsx / evidenceApi.test.ts / fixtures/evidence.ts
    browser/{shell,projects,projects-live}.spec.ts
    browser/{uploads,uploads-live}.spec.ts
    browser/{evidence,evidence-live}.spec.ts
  eslint.config.mjs
  tools/lint/      # isolated lint-only manifest, lockfile and flat configuration
```

| Technology | Version |
|---|---|
| React / React DOM | 19.3.1 |
| TypeScript | 7.0.2 |
| Vite / React plugin | 8.3.5 / 6.1.2 |
| Tailwind CSS / Vite plugin | 4.3.3 |
| React Router | 8.5.0, declarative mode |
| Lucide React | 1.61.0 |
| Vitest / jsdom | 5.0.5 / 30.1.3 |
| React Testing Library | 16.3.3 |
| Playwright | 1.64.1 |

Upstream setup references: [Vite](https://vite.dev/guide/), [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite), [React Router](https://reactrouter.com/start/declarative/installation).

Projects/Cycles, Upload Reports and read-only Evidence Explorer are functional through Prompt 0.7. Reconciliation, the full Overview dashboard and customer reporting remain separate future milestones.

## Prompt 0.4A verification

Verified on 2026-10-24: **19 unit/component tests passed**, **3 real-browser checks passed in Microsoft Edge**, TypeScript checks passed, and the production build succeeded. Desktop and mobile screenshots were inspected. Browser coverage includes widths 320, 390, 768, 1280 and 1440px. The backend suite remained at **67 passed, 1 intentional confidential-data skip**, with its existing Starlette/HTTPX warning; backend source, original workbooks and the existing development database stayed unchanged.

A separate source copy in a new directory with spaces installed from the lockfile using `npm ci --offline` and built without a backend, local env file or existing `node_modules`. It used the installed runtime and npm's existing cache; an actual second laptop has not been exercised. Explicit Tailwind source registration keeps the scan independent of the clone's surrounding folders.

## Prompt 0.4A.1 verification

The refinement passed **27 unit/component tests**, **6 Microsoft Edge browser checks**, TypeScript validation, **ESLint with zero warnings**, and the production build. The resulting desktop and mobile screens were visually inspected, including the 320px layout. Browser tests verify guide navigation/dismissal/reopening, progress labels, focus restoration, reduced motion, five visible navigation links and preserved hidden routes.

Both manifests/lockfiles were installed with offline `npm ci` in a fresh source directory with spaces; its lint, typecheck and build passed without an existing environment, backend or copied dependency directory. Installed Node and cached packages were reused. The backend regression suite remained **67 passed, 1 intentional skip**, with its existing upstream warning. Backend source, existing database and original workbook hashes stayed unchanged. Prompt 0.4B and backend-connected screens were not started.

## Prompt 0.4A.2 verification

Verified on 2026-10-24: **27 unit/component tests passed**, **6 real-browser checks passed in Microsoft Edge**, **ESLint passed with zero warnings**, TypeScript checks passed, and the production build succeeded. Desktop and **320px** Overview screenshots were visually inspected. Browser coverage includes onboarding interactions, active navigation, placeholder routes, mobile focus containment, keyboard navigation, reduced motion and horizontal overflow.

A targeted real-browser color audit sampled **507 rendered text/background pairs** (minimum **4.772:1**) and **21 keyboard-focus states** (minimum outline/background contrast **6.245:1**), plus **20 token pairs** covering semantic colors, controls and accents. It included hover states, Overview, placeholders and the unknown-route state, with no browser errors. Disabled controls were excluded from the text measurements. These are targeted checks, not a full accessibility conformance audit. Screenshots and measurement artifacts stay in ignored local output.

The palette refinement changes only `src/styles/tokens.css`, `src/styles/app.css`, `index.html` and this README. No package, component logic, API, backend, migration, database or confidential workbook changes were needed. The backend tests were not rerun for this presentation-only refinement; the preceding milestone's results are recorded above. The preview remains at **http://127.0.0.1:5173/overview**. No further screen implementation, commit or push was performed.

## Prompt 0.5 verification

Verified on **2026-10-25**:

| Check | Result |
|---|---|
| Unit/component/API-client tests | **47 passed**, five files |
| ESLint | Passed, zero warnings |
| TypeScript | Passed (`tsc --noEmit`, also part of build) |
| Production build | Passed |
| Microsoft Edge browser tests | **10 passed**, including the opt-in real FastAPI test |
| Backend regression suite | **67 passed, 1 intentional confidential-data skip** |
| Protected-file integrity | **64 hashes unchanged**, covering backend files, original workbooks and existing development database |
| Git exclusions | Test database, browser output, dependencies and local database remain ignored |

Component tests cover loading/empty lists, creation success/failure, required-name validation, repeated-submit prevention, selection across routes, cycle clearing on project changes, retries, list refresh, removed selections, focus restoration, concurrent refresh/creation and late responses. Collection tests verify pagination and cancellation. Browser tests cover the full controlled workflow, server failures/retry, duplicate-submit prevention, 320px keyboard forms with long labels, navigation, onboarding and reduced motion.

The live integration test used **real HTTP requests to unchanged FastAPI on port 8000**, backed by a fresh database created with Alembic revisions `0001_create_projects` and `0002_add_ingestion`. The browser created a fictional project and cycle, verified HTTP 201, CORS and request IDs, selected the workspace, reloaded and retrieved the saved cycle again. These were not mocked responses. The retained database is `data/outputs/frontend-tooling/projects-0.5/acceptance.db`; it is separate from `data/local/tracesync.db`. Desktop and 320px screens were visually inspected, including a long-label stress case. That milestone's preview used the synthetic database; current normal startup and isolated test commands are documented above.

The backend still emits its existing upstream Starlette/HTTPX TestClient deprecation warning. Browser tooling emits a harmless inherited color-environment warning. Neither caused a test failure. No backend compatibility defect or new dependency was found. An actual second Windows laptop has not been exercised in this milestone; relative configuration and the existing locked dependencies are preserved. Setup still requires Git, Python 3.12, Node 24, package installation and explicit Alembic migrations. No confidential workbooks or internet services are needed for the project/cycle workflow after installation.

### Files in Prompt 0.5

Created:

```text
frontend/src/types/workspace.ts
frontend/src/services/workspaceApi.ts
frontend/src/contexts/WorkspaceContext.tsx
frontend/src/components/projects/CreationForm.tsx
frontend/src/components/projects/RequestFeedback.tsx
frontend/src/pages/ProjectsPage.tsx
frontend/tests/fixtures/workspace.ts
frontend/tests/ProjectsPage.test.tsx
frontend/tests/workspaceApi.test.ts
frontend/tests/browser/projects.spec.ts
frontend/tests/browser/projects-live.spec.ts
```

Modified:

```text
frontend/src/App.tsx
frontend/src/layouts/AppLayout.tsx
frontend/src/pages/OverviewPage.tsx
frontend/src/styles/app.css
frontend/tests/App.test.tsx
frontend/tests/browser/shell.spec.ts
frontend/README.md
README.md
docs/IMPLEMENTATION_PLAN.md
```

No backend, migration, workbook, API-client foundation, palette-token, dependency or lockfile changes were made. No commit or push was performed. Prompt 0.5 stops here for visual and functional review.

## Prompt 0.6 verification

Completed verification on **2026-10-26**, using Node 24, Microsoft Edge and the existing Python 3.12 environment:

| Check | Result |
|---|---|
| Frontend unit/component/API tests | **72 passed**, seven files |
| ESLint | Passed, zero warnings |
| TypeScript | Passed (`tsc --noEmit` through the production build) |
| Production build | Passed |
| Real-browser suite | **15 passed**, with both live FastAPI tests enabled |
| Backend regression suite | **67 passed, 1 intentional confidential-data skip** |
| Protected-file integrity | **71 unchanged hashes**, including backend, originals, existing database, Projects/Cycles context/page, API client, navigation, palette and manifests/lockfile |
| Local artifact exclusions | Acceptance database, generated XLSX files, dependencies and browser outputs remain ignored |

The upload tests cover empty/partial workspace selection, saved-metadata loading, zero counts, warnings, valid/invalid files, drag/drop, file clearing, exact FormData fields, duplicates, conflicts, safe errors, unavailable backend/retry, duplicate-submit protection and late responses after a cycle change. The browser suite verifies keyboard file selection, reduced motion, the desktop layout and 320px layout. Visual inspection found a narrow-screen workspace layout issue; it was fixed by placing the workspace action below its metadata at 320px, and a geometry assertion now checks that behavior. Final desktop/mobile screenshots were inspected again.

The live upload test used a **fresh, disposable Alembic-migrated database** at `data/outputs/frontend-tooling/uploads-0.6/acceptance.db`, separate from the unchanged normal database. It generated genuine synthetic XLSX files with the existing Python generator. No company workbooks were read for the tests. Real browser HTTP requests verified:

- **422:** invalid XLSX bytes, missing required sheet, missing required headers; workbook/evidence counts remained zero before a valid import.
- **201:** transformation import with **3** rows, and post-upload import with **3 Objects / 4 Errors** rows.
- **200:** the same transformation bytes with a different filename returned `duplicate: true`, preserving the original workbook ID, timestamp and filename.
- **409:** a different valid workbook for the occupied role was rejected without replacing the original.
- Actual CORS headers and a browser-generated multipart boundary; persisted evidence totals **3 / 3 / 4**; the API's cycle ingestion status `complete`; saved imports retrieved again after navigation and reload/reselection.

HTTP 413/415 UI feedback was exercised with controlled component fixtures; configured limits and unsupported-file behavior are also covered by the existing backend suite. Those two rejection statuses were not exercised through a real browser upload in this milestone. The verification above enabled both live tests using the former manual setup, so all 15 browser checks ran. Current tests use the isolated launcher documented above. The confidential-data backend test remained intentionally skipped.

### Demo Portability Check

No application dependencies, cloud services, Docker, startup scripts or backend changes were added. Python 3.12, Node 24, repository-relative settings, the existing lockfiles and explicit Alembic migrations remain sufficient. The live upload test additionally needs the installed backend Python environment and a Playwright browser or Microsoft Edge. A second physical laptop was not exercised; fresh-database startup and local HTTP ingestion were verified here. Match frontend/backend upload limits when customizing them. Browser cancellation cannot guarantee rollback of a request already processed by FastAPI. The existing upstream TestClient deprecation warning remains, without test failures.

That milestone's preview used the retained synthetic acceptance database. The normal preview now uses `data/local/tracesync.db`; synthetic projects are not seeded into it. Selection still resets on reload. To try new files, create another cycle; occupied roles are never replaced.

### Files in Prompt 0.6

Created:

```text
frontend/src/types/workbook.ts
frontend/src/services/workbookApi.ts
frontend/src/components/uploads/uploadRequirements.ts
frontend/src/components/uploads/ImportDetails.tsx
frontend/src/components/uploads/WorkbookUploadCard.tsx
frontend/src/pages/UploadReportsPage.tsx
frontend/tests/fixtures/workbooks.ts
frontend/tests/workbookApi.test.ts
frontend/tests/UploadReportsPage.test.tsx
frontend/tests/browser/uploads.spec.ts
frontend/tests/browser/uploads-live.spec.ts
```

Modified:

```text
frontend/.env.example
frontend/src/vite-env.d.ts
frontend/src/App.tsx
frontend/src/styles/app.css
frontend/tests/App.test.tsx
frontend/tests/browser/shell.spec.ts
frontend/README.md
README.md
docs/IMPLEMENTATION_PLAN.md
```

No backend compatibility defect was found. Projects/Cycles, original confidential workbooks, the original database, shared API-client behavior and business rules were preserved. No commit or push was performed. Prompt 0.6 stops here for visual and functional review; Evidence Explorer and later features remain unimplemented.

## Prompt 0.7 verification

Verified on **2026-10-26**, using Node 24, the existing Python 3.12 backend environment and Microsoft Edge:

| Check | Final result |
|---|---|
| Frontend unit/component/API tests | **89 passed**, nine files, using the normal `npm.cmd test` command |
| ESLint | Passed, zero warnings |
| TypeScript | Passed (`tsc --noEmit` through the production build) |
| Production build | Passed |
| Browser suite | **19 passed**, including all three opt-in live FastAPI tests |
| Backend regressions | **67 passed, 1 intentional confidential-data skip** |
| Protected-file hashes | **79 unchanged**, covering backend, originals, existing database, Projects/Cycles, Upload Reports, existing API services, palette and dependency manifests/lockfile |

Component tests cover all three datasets, missing workspace/source roles, imported-but-empty data, response fields, row details, raw padding versus normalized values, separate manual/tool statuses, missing identities, zero sequence numbers, repeated names, pagination, page-filter scope, errors/retry and stale tab/cycle responses. Browser checks cover desktop/320px tables, horizontal keyboard scrolling, arrow-key tabs, dialog focus containment, Escape, focus restoration and actual source retrieval.

The live evidence test used the separate Alembic-migrated database at `data/outputs/frontend-tooling/evidence-0.7/acceptance.db`. It generated fictional XLSX inputs with the existing generator and appended 30 fictional transformation rows to the generator's three findings. It verified actual browser HTTP 200 retrieval from all three evidence endpoints, transformation pages of **25 + 8 = 33 distinct record IDs**, three upload-object rows and four technical messages. The two original same-object findings remained separate source rows. Raw strings, normalized identities, manual/tool distinctions and missing message identities were inspected in the real browser. Workbook metadata/hashes and the first evidence page were identical before/after browsing. Missing-workbook behavior and cycle reset were verified against a second synthetic cycle with no imports. No company workbook was used as test input.

An earlier unrestricted parallel frontend run hit simultaneous timeouts in existing and new DOM tests. With the worker cap of two, the full suite passed repeatedly without increasing timeouts or disabling rules. Visual inspection also found a selected tab clipped after desktop-to-mobile resizing; horizontal reveal now accounts for focus space and fractional pixels, and a live-browser assertion verifies full visibility. Final screenshots were inspected after the fix. Existing TestClient and terminal-color warnings remain without test failures.

### Demo Portability Check for Prompt 0.7

No backend endpoint, schema, migration, application dependency, external service or machine-specific source path was added. Existing two-terminal Windows setup and environment configuration still apply. Source inspection is local and read-only; no evidence contents are logged or saved to browser storage. Generated workbooks, databases and screenshots remain ignored. All three live browser tests ran for this verification. They are now enabled only through `npm run test:browser:live`, with automatic test database isolation and disposal. The confidential-data backend test remained intentionally skipped. A second physical laptop has not been exercised.

That milestone's preview used `data/outputs/frontend-tooling/evidence-0.7/acceptance.db` on API port 8000. This caused its synthetic projects to remain visible in the normal preview. The investigation preserved that entire database and switched the preview to the separate normal database. See [Test data isolation](../docs/TEST_DATA_ISOLATION.md). Selection resets on reload, as in earlier milestones.

Known limits: fixed page size 25; filtering covers only the currently loaded records; global search/sorting are not supported by the current API; raw values are read-only; records are listed in the backend's worksheet-row/ID order. Normalized values are comparison keys, never evidence of reconciliation. No matching, root-cause grouping, customer actions, evidence editing or reporting was added.

### Files in Prompt 0.7

Created:

```text
frontend/src/types/evidence.ts
frontend/src/services/evidenceApi.ts
frontend/src/components/evidence/evidenceColumns.ts
frontend/src/components/evidence/EvidenceValue.tsx
frontend/src/components/evidence/EvidenceTable.tsx
frontend/src/components/evidence/EvidenceDetail.tsx
frontend/src/pages/EvidenceExplorerPage.tsx
frontend/tests/fixtures/evidence.ts
frontend/tests/evidenceApi.test.ts
frontend/tests/EvidenceExplorerPage.test.tsx
frontend/tests/browser/evidence.spec.ts
frontend/tests/browser/evidence-live.spec.ts
```

Modified:

```text
frontend/src/App.tsx
frontend/src/styles/app.css
frontend/tests/App.test.tsx
frontend/tests/browser/shell.spec.ts
frontend/vitest.config.ts
frontend/README.md
README.md
docs/IMPLEMENTATION_PLAN.md
```

Existing uncommitted Prompt 0.6 changes were preserved. No commit or push was made. Prompt 0.7 stops here for visual and functional review.
