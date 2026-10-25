# TraceSync frontend

Prompt 0.4A.1 refines the existing shell with a compact Overview and an interactive Getting Started guide. The five visible navigation entries lead to Overview and four future-screen placeholders; two hidden future routes remain available directly. The existing framework setup and unused typed API client are preserved. There are no project/cycle operations, uploads, evidence tables, reconciliation, approvals, reports, authentication or AI. The frontend starts without a backend or database and makes no API requests.

Prompt 0.4A.2 applies the shared blue, white and red-violet palette to that existing interface. It changes presentation only, with no new dependencies or changes to routes, onboarding behavior or the API client.

## Windows prerequisites

Install Git and **64-bit Node.js 24 LTS, version 24.15.0 or later within Node 24**, with npm **11 or 12**. Tested versions: Node **24.22.1**, npm **11.19.1**. `.nvmrc` records that Node version for compatible version managers. Download Node from the [official website](https://nodejs.org/en/download), then open a new PowerShell terminal.

```powershell
node --version
npm.cmd --version
```

If Node 18 or 22 is reported, switch to Node 24 before installing. The current stable router and DOM test environment require a newer runtime than the original laptop's default Node 18. This project does not change global Node/npm installations. PowerShell 5.1+ works; `npm.cmd` avoids execution-policy restrictions on `npm.ps1`. Python, Excel, Docker and a running backend are not needed here.

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

Installation initially needs npm-registry access. Installed assets use system fonts and bundled icons, without remote fonts, CDNs or runtime internet dependencies. No Docker or setup/deployment infrastructure was added.

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

Playwright tests rendered desktop/mobile navigation, visible and hidden routes, direct reloads, modal focus containment, Escape/backdrop/close-button behavior, focus restoration, skip navigation, desktop resizing and mobile overflow. It also covers guide Next/Back, numbered steps, skip/reopen/restart, progress labeling, reduced motion, and absence of backend requests. Choose one browser setup from `frontend/`:

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

## Routes, design and accessibility

| Route | Screen |
|---|---|
| `/` | Redirect to `/overview` |
| `/overview` | Compact welcome, interactive guide, no-project empty state and review workflow |
| `/projects` | Projects placeholder |
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

Progress is explicitly labeled **Guide progress**. Reading a step never completes project work, creates a record or uploads a report. The no-project state remains unchanged after finishing. All guide state stays in React memory; no localStorage, sessionStorage, backend or authentication is used. Reloading or leaving/revisiting Overview resets the guide. The View projects link opens the existing placeholder, whose project tools remain unimplemented.

## API configuration

`src/services/apiClient.ts` centralizes `VITE_API_BASE_URL`, defaulting to `http://127.0.0.1:8000/api/v1`. Vite reads frontend `.env.local`, independently of the backend's root `.env`. Restart Vite after environment changes.

The generic `request<T>` accepts API-relative paths, preserves caller headers and cancellation, expects JSON, and supports empty HTTP 204 responses. `ApiError` carries a safe message, HTTP status, code and request ID. It recognizes the backend's `{ error: { code, message }, request_id }` envelope, safely handles non-JSON/network failures and does not force multipart content types. There are no endpoint-specific calls, automatic requests, retries or persisted browser data.

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
    pages/         # Overview, placeholder, not-found
    services/      # unused generic API client
    types/         # backend error-envelope contract
    styles/        # tokens and Tailwind rules
  tests/
    setup.ts / App.test.tsx / GettingStartedGuide.test.tsx / apiClient.test.ts
    browser/shell.spec.ts
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

Prompt 0.4B will implement the functional Overview only after visual approval. Later screens remain separate milestones.

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
