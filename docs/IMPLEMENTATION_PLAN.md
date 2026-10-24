# TraceSync implementation plan

Plan based on [Project_Reference.md](Project_Reference.md) and the inspected schemas. Updated on 2026-10-24 for a solo developer. Prompt 0.1 discovery, Prompt 0.2 foundation and Prompt 0.3 ingestion are complete. Reconciliation and later business workflows remain future work.

## Current boundary — Prompt 0.3 ingestion complete

- Added project/cycle endpoints and one atomic ingestion service for transformation/post-upload workbooks, with explicit source models and Alembic revision `0002_add_ingestion`.
- Implemented separate `Detailed_LOG`, `Objects` and `Errors` adapters, preserving raw payloads, normalized identity fields, repeated rows, manual annotations and Excel-row provenance.
- Added validation, hash-based idempotent repeat uploads, role-conflict rejection and paginated metadata/evidence retrieval. No parent linking or error classification is performed.
- Added fictional source-controlled generators, synthetic parser/API tests and a source-copy portability test with a fresh migrated database and outbound connections blocked. Default suite: 67 passed, one opt-in company-data check skipped. The full suite with local verification enabled passed all 68 tests, including counts 361 / 205 / 1,226 and unchanged originals.
- Documented fresh Windows setup, configurable limits, synthetic upload/retrieval commands and the remaining second-laptop setup steps in [backend/README.md](../backend/README.md). Initial package installation needs network; ingestion does not. No Docker or setup/launch automation was added.

The next separately authorized stage is reconciliation. Prompt 0.3 does not approve customer actions, infer scope from source absence, group blockers, build UI or generate reports.

## Prompt 0.2 backend foundation complete

The attached Prompt 0.2 narrows this step to a foundation, not the full ingestion milestone below. It supplies:

- Isolated Python 3.12 environment, runtime/dev dependencies, tested dependency constraints and root `.env.example`.
- `TraceSync API` application factory with `/api/v1/health`, database connectivity `/api/v1/ready`, local CORS, centralized errors and request metadata logging.
- SQLAlchemy engine/session helpers and only the five-field `Project` model, with UUIDs and UTC timestamps.
- Explicit Alembic revision `0001_create_projects`; no startup schema creation.
- Twenty-five passing isolated tests, dependency consistency check and real Uvicorn health/readiness/OpenAPI/Swagger verification. One upstream Starlette/HTTPX TestClient deprecation warning remains documented.
- Beginner-friendly [backend setup instructions](../backend/README.md).

The development database is local and gitignored. At the end of Prompt 0.2 there was no ingestion, project CRUD or cycle/source evidence model. Prompt 0.3 adds those ingestion features above; reconciliation, frontend, AI, authentication and Docker remain unimplemented.

## Prompt 0.1 — initialization and discovery complete

Completed:

- Inspected the existing Git repository and preserved existing files.
- Added a minimal backend/frontend/test folder structure, without application scaffolding or dependency installation.
- Profiled every worksheet in all three workbooks with Python/OpenPyXL.
- Documented exact fields, counts, manual-data separation, matching candidates, export layouts and unresolved rules.
- Added a reusable read-only inspector and expanded `.gitignore` coverage.
- Added beginner documentation explaining the product, layers and engineering decisions.

At the end of Prompt 0.1 there were no application routes or database tables. The original files and project reference remain unchanged. Import adapters were subsequently added in Prompt 0.3; reconciliation rules, UI, report generation and AI remain future work.

Verification performed for this step:

- Ran the inspector from the root as a script and from `backend/` as a module.
- Confirmed all seven sheet inventories and field/category totals, with SHA-256 hashes identical to the three original-file baselines.
- Confirmed five sanitized sample records per populated sheet where available; the profile does not contain the supplied example names or transport/layer identifiers.
- Exercised missing-input and input-overwrite rejection, checked Python syntax and checked local documentation links.
- Checked 21 representative sensitive/generated paths are ignored and six intended source/documentation/example paths remain eligible for Git. No dataset is currently tracked; `git diff --check` passed for the tracked change.

Those checks cover the discovery utility, not matching accuracy. The separate Prompt 0.2 foundation tests are described above.

## Before ingestion/reconciliation — confirm rules and prepare fixtures

Use the [stage-specific questions for seniors](SENIOR_QUESTIONS.md), starting with scope/access mechanics and message-block semantics. Record answers in [mapping-rules.md](mapping-rules.md) with source, date, examples and acceptance checks. BR-001 records customer reporting of out-of-scope objects; BR-002 defines them by absence from the shared TR; BR-003 records that customers usually add the object to that TR or provide another TR. Authoritative membership evidence, label ownership, decision/response evidence, other inclusion rules, repeated object rows and recheck membership still require clarification. Clearly distinguish confirmed requirements from proposals.

Prompt 0.3 supplies **synthetic** workbook fixtures covering verified layouts, padding, blank identifiers, repeated keys, several findings and formatting-only rows. Extend these when new verified rules require more cases. Keep supplied internal workbooks local and ignored; committed fixtures must not copy their identifiers or free text.

**Exit check:** every adapter field maps to an actual source column; unconfirmed rules have a visible review fallback. Unresolved inclusion rules need not block ingestion, but must block automatic inclusion/approval. Unconfirmed block semantics must not enable automatic parent linkage.

## Milestone 1 — local backend and ingestion

**Progress:** the foundation and ingestion portions are complete under Prompts 0.2–0.3. This milestone's upload/parsing/persistence scope is implemented; reconciliation remains separate.

**Deliverable:** both source files upload and return verified counts and source-row provenance.

1. Add a Python dependency manifest and local environment after authorization. Use FastAPI, Pydantic v2, SQLAlchemy 2, Alembic and OpenPyXL. Add pandas when its table operations simplify a real task; it is unnecessary for the current inspector.
2. Add SQLite project/cycle storage and one initial migration. Keep raw records, normalized fields, imported manual annotations and reviewer events separate.
3. Implement health, project, cycle and file endpoints. Limit local CORS, file size and accepted formats; validate workbook parseability, expected tabs and trimmed headers. Do not expose local storage paths.
4. Implement separate A `Detailed_LOG`, B `Objects` and B `Errors` adapters. Preserve raw text, whitespace and Excel rows. Read blank summaries without relying on pivots.
5. Detect duplicate file hashes within the defined project/cycle context, and report parse warnings without logging full technical messages.

**Verification:** parser tests for exact headers, padded strings, missing fields and malformed files; integration upload tests; count/provenance checks against local copies. Expect A 361 records and B 205 + 1,226 records in the supplied sample. C is not an ingestion requirement.

## Milestone 2 — conservative reconciliation

**Deliverable:** a saved, explainable draft of objects and findings, with uncertain cases visible.

1. Match normalized `(type, name)` keys; keep name-only and conflicting-type cases as candidates.
2. Attach direct-key messages while preserving original subjects. Add block-context association only after validation, with sequence/anchor checks and an unlinked fallback.
3. Preserve repeated input rows and many-to-one messages. Distinguish object identity, category comparison and reviewer disposition.
4. Add only supported message-to-category patterns. Keep unknown patterns visible; do not use B's manual labels as automatic features or silently copy them into approval.
5. Make reconciliation idempotent within a clearly defined source/rule version. Define rerun behavior before allowing it to overwrite reviewed work.

**Verification:** exact, unmatched, ambiguous, multiple-category and repeated-key tests; blank/context messages retained; no row multiplication on duplicate keys; no customer disposition inferred from categories. Check the three reference examples and the observed 172 common typed keys without treating those counts as accuracy.

## Milestone 3 — reviewer workflow

**Deliverable:** a reviewer can upload, inspect evidence, edit a finding and save a decision.

Build React/TypeScript with Vite and Tailwind once API shapes exist. Start with upload validation and a searchable reconciliation table. Add an evidence panel with workbook/sheet/row references, separate object-match and finding-comparison states, and disposition/action/note/recheck controls. Save changes through the backend with an audit event. Approval must be explicit and survive reloads.

Keep scope/access meaning distinct from the decision to include an entry in the report. Out-of-scope entries need customer visibility under BR-001; internal report approval does not establish customer permission or actual access.

**Verification:** meaningful interaction tests for a successful review, invalid edits and persistence. A full-stack test should prove that raw evidence remains unchanged after a reviewer edit.

## Milestone 4 — reviewed Excel export

**Deliverable:** download a workbook assembled from approved reviewer decisions.

Implement preview validation, approval gating and OpenPyXL export. The reference's `Error details` order is `Status Inf`, `Object Typ`, `Object Name`, `Status`, `Comments`; `Recheck` is `Object Name`, `Status`, `Comments`. Agree how reviewer actions map to those fields, and whether rechecks also remain in details. Keep audit information internal unless the customer approves an audit tab. Agree a simple summary rather than copying the broken pivot dependency.

Preserve meaningful approved text, use readable widths/frozen headers/filters, and write customer text safely as text rather than unintentionally creating formulas. Do not invent owners or actions. Unapproved findings must not appear as confirmed customer instructions.

Retain reviewed and approved `Out of scope` entries for customer revalidation and an access decision before the second run, following [BR-001](mapping-rules.md). Do not automatically turn the label into `EXCLUDE`. Confirm their sheet placement and required explanation/request with seniors; do not infer granted access from report approval or export.

**Verification:** export/reopen workbook, check sheet names and column ordering, approved edits, data types and row counts; test that pending findings cannot leak into approved output and approved out-of-scope entries are retained. Check that report approval cannot imply a customer access decision. Compare against C independently of normal processing and document justified differences.

**MVP stopping point:** milestones 1–4 provide upload → reconciliation → review → export. Finish this path before expanding the product.

## Milestone 5 — Smart Blocker Radar

**Deliverable:** potential shared blockers with visible evidence and confirm/dismiss controls.

Extract exact transport-layer and lock-request identifiers from verified message patterns. Group only supported shared identifiers across distinct affected objects; show source messages and an investigation suggestion. Keep same-category-only groups out. Retain group decisions in the audit history. Use deterministic text templates.

**Verification:** multiple supported objects produce a group; generic category equality does not; repeated messages on one object do not inflate affected-object counts. Demonstrate a real group only if the data supports it.

## Milestone 6 — optional explanations

Defer unless the complete workflow is stable and time remains. Define a disabled/template provider first. An approved external provider, if authorized, receives selected sanitized evidence only. Validate typed output and source-record references; label output as suggestions. It must not alter identities, approval or report facts. Core processing continues offline.

## Milestone 7 — evidence and demo hardening

Keep essential tests running throughout development. At the end, add `docs/evaluation.md` and `DEMO.md`, measure actual processing latency, and run one end-to-end upload/review/export/reopen test. Use C only after the lead validates it; define verified match/action labels before reporting precision or recall. Measure human review time against a comparable manual baseline before claiming time savings.

Document exact local start commands, versioned dependencies, backup synthetic data and limitations. Rehearse a 6–7 minute offline walkthrough. Add Docker Compose once the application has reliable local commands. Defer PostgreSQL, authentication, cross-cycle analytics and external ticket integrations until deployment requirements justify them.

## Solo-developer scope choices

- Prefer one project/cycle workflow, one database and synchronous processing for these small files until measurements show a need for background jobs.
- Add new workbook layouts through adapters. Keep rule changes out of UI conditionals.
- Add counts, warnings, provenance and review controls before dashboards or AI explanations.
- Consider a warning when manual labels disagree with broad tool status, and a visible unsupported-context queue. These small additions address observed data issues without changing business decisions.
- Use synthetic fixtures to make demonstrations repeatable and privacy-conscious. Avoid polishing secondary features before the export can be trusted.

The user will authorize each next implementation task. Prompt 0.3 authorizes the completed ingestion scope only; this future plan does not authorize advancing into reconciliation.
