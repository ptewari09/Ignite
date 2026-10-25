# TraceSync frontend

Prompt 0.5 makes **Projects and Upload Cycles** functional using the existing FastAPI endpoints. Users can list/create projects, list/create a project's cycles and select a shared workspace. The five visible navigation entries, compact Overview, educational Getting Started guide and blue/white/red-violet design system are preserved. The three remaining visible future screens and two hidden future routes are placeholders. Upload UI, evidence tables, reconciliation, approval, reporting, authentication and AI remain future work.

Prompt 0.4A.2 applies the shared blue, white and red-violet palette to that existing interface. It changes presentation only, with no new dependencies or changes to routes, onboarding behavior or the API client.

## Windows prerequisites

Install Git and **64-bit Node.js 24 LTS, version 24.15.0 or later within Node 24**, with npm **11 or 12**. Tested versions: Node **24.22.1**, npm **11.19.1**. `.nvmrc` records that Node version for compatible version managers. Download Node from the [official website](https://nodejs.org/en/download), then open a new PowerShell terminal.

```powershell
node --version
npm.cmd --version
```

If Node 18 or 22 is reported, switch to Node 24 before installing. The current stable router and DOM test environment require a newer runtime than the original laptop's default Node 18. This project does not change global Node/npm installations. PowerShell 5.1+ works; `npm.cmd` avoids execution-policy restrictions on `npm.ps1`. The Projects workflow also needs **Python 3.12** and the local FastAPI server, as described below. Excel and Docker are unnecessary. Overview and placeholders render without a backend; Projects shows a recoverable connection error if the API is unavailable.

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
& .\backend\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
& .\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload --no-access-log
```

**Terminal 2: React.** Install dependencies on first setup, then start Vite:

```powershell
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

Open **http://127.0.0.1:5173/projects**. The default API URL is `http://127.0.0.1:8000/api/v1`; frontend `.env.local` can override `VITE_API_BASE_URL`. Backend CORS already permits `http://127.0.0.1:5173` and `http://localhost:5173`. No backend change is required. Leave both server terminals running; use another terminal for test commands. Press **Ctrl+C** in a server terminal to regain its command prompt. On later launches, installation can be omitted; keep migrations current before starting FastAPI.

The normal database is the configurable, ignored `data/local/tracesync.db`. Alembic creates a fresh schema; the API never creates tables or seeds projects at startup. No existing database, virtual environment, confidential workbook or machine-specific folder is required after cloning and installing dependencies.

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

Vite supports direct-link SPA history fallback. Deploying `dist/` later will require the host to return `index.html` for application routes; deployment remains outside this milestone.

## Real-browser verification

Playwright tests render desktop/mobile navigation, visible and hidden routes, direct reloads, modal focus containment, Escape/backdrop/close-button behavior, focus restoration, skip navigation, desktop resizing and mobile overflow. They also cover the educational guide, controlled project/cycle creation and selection, retries, duplicate-submit prevention and keyboard forms at 320px. Controlled tests intercept only fictional test responses; they do not verify FastAPI integration. The guide alone still makes no API requests. Choose one browser setup from `frontend/`:

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

Playwright starts Vite if needed or reuses the server on port 5173. It stops a server it started itself, leaving any reused preview running. Screenshots/failure traces go in ignored `frontend/test-results/`. Browser installation initially needs internet; the installed browser can test the shell offline.

### Optional real FastAPI browser test

`projects-live.spec.ts` is skipped by default. It makes real browser HTTP requests without interception and **creates fictional records**, so use an isolated database. Stop any regular API process using port 8000, then run the following in a terminal at the repository root. Use a new unused database filename when a fresh database is desired; no existing file is deleted:

```powershell
$env:TRACESYNC_DATABASE_URL = 'sqlite+pysqlite:///data/local/projects-browser-test.db'
& .\backend\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
if ($LASTEXITCODE -ne 0) { throw 'Test database migration failed.' }
& .\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --no-access-log
```

Keep the frontend configured for that same API URL. In a separate terminal at `frontend/` with Node 24 selected:

```powershell
$env:TRACESYNC_BROWSER_CHANNEL = 'msedge'
$env:TRACESYNC_LIVE_API_URL = 'http://127.0.0.1:8000/api/v1'
npm.cmd run test:browser -- --workers=3
Remove-Item Env:TRACESYNC_LIVE_API_URL
Remove-Item Env:TRACESYNC_BROWSER_CHANNEL
```

The opt-in URL tells the test which real API responses to verify; it does not reconfigure Vite. The frontend's `VITE_API_BASE_URL` must match it. This checks HTTP 201 responses, CORS, request IDs, project/cycle relationships, real database retrieval after reload and desktop/mobile rendering. After stopping the test backend with Ctrl+C, remove `TRACESYNC_DATABASE_URL` from that terminal before launching the normal backend again. The test database and browser artifacts remain ignored by Git. The test deliberately leaves its fictional records for inspection; there are no deletion endpoints.

## Routes, design and accessibility

| Route | Screen |
|---|---|
| `/` | Redirect to `/overview` |
| `/overview` | Compact welcome, interactive guide, no-project empty state and review workflow |
| `/projects` | Functional project directory, creation forms, cycle listing/creation and workspace selection |
| `/upload-reports` | Upload Reports placeholder |
| `/evidence` | Evidence Explorer placeholder |
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

**Limits:** the backend allows repeated project/cycle names and has no create idempotency key. The submit guard prevents simultaneous accidental requests, not separate intentional creations. After a network interruption, refresh before trying again: a server may have saved the first request without its response reaching the browser. Lists currently load all pages into memory; server-side search/paging UI is deferred. There is no editing, deletion, cross-tab selection persistence or upload UI in this milestone.

## API configuration

`src/services/apiClient.ts` centralizes `VITE_API_BASE_URL`, defaulting to `http://127.0.0.1:8000/api/v1`. Vite reads frontend `.env.local`, independently of the backend's root `.env`. Restart Vite after environment changes.

The generic `request<T>` accepts API-relative paths, preserves caller headers and cancellation, expects JSON, and supports empty HTTP 204 responses. `ApiError` carries a safe message, HTTP status, code and request ID. It recognizes the backend's `{ error: { code, message }, request_id }` envelope, safely handles non-JSON/network failures and does not force multipart content types. Its behavior is unchanged. `workspaceApi.ts` adds only the four existing endpoints below; Projects fetches on entry/selection and explicit refresh. No automatic retry or browser-storage persistence is added.

| Method | Existing endpoint | Request / response |
|---|---|---|
| GET | `/api/v1/projects?limit=200&offset=…` | Page of `id`, `name`, `description`, `created_at`, `updated_at` |
| POST | `/api/v1/projects` | `{ name, description }` → saved project, HTTP 201 |
| GET | `/api/v1/projects/{project_id}/cycles?limit=200&offset=…` | Page of `id`, `project_id`, `name`, `created_at`, `ingestion_status` |
| POST | `/api/v1/projects/{project_id}/cycles` | `{ name }` → saved cycle, HTTP 201 |

Page envelopes contain `items`, `total`, `limit` and `offset`. The service follows all pages before publishing a list; canceled or older requests do not overwrite a newer selection. No customer fields, cycle progress or extra endpoints are inferred from the broader project specification.

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
    components/    # brand, sidebar, navigation, onboarding/GettingStartedGuide + guideSteps
    contexts/      # in-memory workspace, fetched metadata and request lifecycle
    pages/         # Overview, Projects, placeholder, not-found
    services/      # existing generic API client + typed workspace endpoints
    types/         # backend error-envelope and project/cycle/page contracts
    styles/        # tokens and Tailwind rules
  tests/
    setup.ts / App.test.tsx / GettingStartedGuide.test.tsx / apiClient.test.ts
    ProjectsPage.test.tsx / workspaceApi.test.ts / fixtures/workspace.ts
    browser/{shell,projects,projects-live}.spec.ts
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

Only Projects and Cycles are functional in Prompt 0.5. The full Overview dashboard and other screens require separate authorization after visual/functional review.

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

The live integration test used **real HTTP requests to unchanged FastAPI on port 8000**, backed by a fresh database created with Alembic revisions `0001_create_projects` and `0002_add_ingestion`. The browser created a fictional project and cycle, verified HTTP 201, CORS and request IDs, selected the workspace, reloaded and retrieved the saved cycle again. These were not mocked responses. The isolated database is `data/outputs/frontend-tooling/projects-0.5/acceptance.db`; it is separate from the unchanged existing `data/local/tracesync.db`. Desktop and 320px screens were visually inspected, including a long-label stress case. The preview is **http://127.0.0.1:5173/projects** and uses the isolated synthetic database.

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
