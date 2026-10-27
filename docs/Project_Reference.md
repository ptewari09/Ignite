# TraceSync — Codex-Ready Project Reference & Implementation Plan

**Version:** 0.1 — Initial hackathon prototype  
**Status:** Proposed specification; validate business rules with transformation lead  
**Challenge:** #2 — Automation Auditor  
**Primary goal:** Automate manual object-and-error reconciliation between transformation and post-upload Excel reports, support expert review, and produce a customer-ready Excel report.  
**Differentiator:** Smart Blocker Radar — evidence-backed grouping of potentially shared blockers.  
**Scope philosophy:** Build one trustworthy end-to-end workflow first. Preserve flexibility for changing report formats and decision rules.

---

## 1. Executive summary

TraceSync is a human-in-the-loop automation review application. A SmartTool performs code remediation across repeated upload cycles. After an initial transformation check and a subsequent code upload, transformation leads currently compare spreadsheets manually: they map code objects and associated errors, inspect technical messages, decide which findings belong in a customer report, and prepare that report in Excel. Customers may need time to fix blockers or grant access, while the company prepares subsequent uploads.

**Prototype promise:** Given the two source reports, TraceSync will parse them, match object identities and their error evidence, flag uncertain or conflicting cases, offer a review interface, and export a customer-facing workbook. Smart Blocker Radar groups findings that *may* share an underlying cause, showing the evidence and affected objects. An optional AI service can explain evidence and suggest investigation steps, but never invent facts or automatically approve customer actions.

**What TraceSync is not:** a replacement for SmartTool, a fully autonomous SAP remediation agent, or a guarantee that an error has been fixed. It is a reconciliation, review, reporting, and eventually cycle-tracking layer.

### Success criteria for first demo

1. Upload both source Excel files and parse all relevant tabs without modifying originals.
2. Show object-level reconciliation, including exact matches, mismatches, unmatched objects and ambiguous cases.
3. Preserve traceability from each proposed finding to source workbook, sheet, row and original text.
4. Let a lead approve, edit, exclude or flag findings for recheck.
5. Export a customer-ready `.xlsx` that follows the supplied reference report's logical structure.
6. Demonstrate Smart Blocker Radar on actual shared identifiers found in the reports, or explicitly show that no qualifying group exists.
7. Report measured processing time and comparison metrics against a verified reference.

---

## 2. Business workflow and vocabulary

### Existing process

1. **Transformation check:** SmartTool checks code objects and generates an initial transformation/error log.
2. **Code remediation/upload:** SmartTool performs code changes and attempts upload.
3. **Post-upload review:** A post-upload workbook records object-level outcomes and detailed messages.
4. **Manual mapping:** A transformation/technical lead maps object names and their corresponding errors across the two workbooks, investigates differences and selects actionable findings.
5. **Customer report:** The lead prepares a third workbook containing customer-facing findings and recheck items.
6. **Customer resolution:** Customer may adjust configuration, unlock objects, provide access or complete other prerequisites.
7. **Next cycle:** Internal team prepares another upload; some findings may recur or change.

### Plain-English definitions

- **Code object:** A named unit of SAP code/configuration such as a program, class, function or related component.
- **Transformation finding:** A message or issue recorded during the initial check.
- **Upload finding:** A message or issue recorded after SmartTool attempts changes/upload.
- **Reconciliation:** Determining whether records in different reports refer to the same object and how their findings correspond.
- **Blocker:** A condition that may prevent an intended operation, such as a missing transport layer or an object lock.
- **Actionable:** A finding requiring someone to do something. This must be determined by validated rules or a reviewer, not assumed from the word “error.”
- **Recheck:** A finding explicitly marked for further verification; the precise customer-specific meaning needs confirmation.

### Critical conceptual distinction

**Same object is not the same as same error.** The system must model object identity and finding identity separately. An object may match across reports while its error category changes. Multiple detailed log messages can belong to one object; one shared infrastructure condition may affect several objects. Conversely, two errors with the same category may have different causes.

---

## 3. Supplied datasets and what we know

### Workbook A — `Zf_LE1_Transformation_Check_Objects_Error_LOG.XLSX`

- Tabs: `Summary`, `Detailed_LOG`.
- `Detailed_LOG` contains approximately **361** detailed findings and **309** distinct normalized object names in prior analysis.
- Relevant concepts: object type, object name, error category, error message, suggested action.
- The `Summary` tab was not populated with useful values in the inspected copy; do not depend on it.
- Use as the **initial transformation evidence**, not necessarily the definitive list of intended changes.

### Workbook B — `Upload errors.xlsx`

- Tabs: `Objects`, `Errors`.
- `Objects` contains approximately **205** records, **203** distinct normalized object names; `Errors` approximately **1,226** detailed messages.
- The `Objects` sheet contains manually added status/comments in the supplied sample. These may be reviewer-created labels, **not raw tool outputs**. Keep them separate and do not leak them into automatic classification during evaluation.
- Use `Objects` for object-level upload results and `Errors` for detailed technical evidence. Determine their exact join key(s) from actual headers and samples before coding.

### Workbook C — `ZF_LE1_Upload_Errors.xlsx`

- Tabs: `Summary`, `Error details`, `Recheck`.
- `Error details` contains approximately **153** rows and **151** distinct normalized object names; `Recheck` has **4** entries.
- This is the **manually prepared customer-facing reference**, used to evaluate the generated report. It is not an input needed for ordinary report generation.
- Preserve its expected logical columns, sheet names and ordering after confirming the actual layout. The `Summary` tab appears to contain formatting/pivot structure without populated data in the supplied copy.

### Prior exploratory comparisons

- **172** distinct normalized object names appeared in both Workbook A's detailed log and Workbook B's `Objects` sheet.
- All **151** distinct names in the reference customer report appeared in Workbook B's `Objects` sheet.
- These are **exact normalized name comparisons**, not verified SAP semantic matches; component names, aliases and object types may change results.
- Do **not** infer that 172 objects were successfully remediated, that the other 31 are all new failures, or that every excluded upload object should be omitted.

### Concrete examples to retain for development

- `ZRMMIMPORT_2`: `OBJ_LOCKED` appears in transformation and upload contexts; upload evidence references transport `LE1K9A7GHH`. Match the object and preserve the transport identifier as evidence.
- `ZSLO_COND_SEND`: `NO_TLAYER` appears in transformation/upload contexts; detailed evidence references missing transport layer `ZD87`. Extract the identifier only from actual messages and verify it.
- `Z_CL_HUM`: upload messages include a transport lock and methods not modified; no exact name match in the transformation log was found in the earlier name comparison. Show this as **upload-only / needs review**, not an automatically proven automation defect.

### Data handling rules

- Never overwrite the uploaded originals.
- Preserve original text and row provenance, including sheet and Excel row number.
- Parse formula cells carefully; avoid trusting stale cached formula values without validation.
- Normalize empty values, whitespace and casing for matching; preserve originals for display.
- Validate that expected sheet names and required columns exist; show clear import errors if not.
- Avoid sending customer-sensitive records to an external LLM unless authorized.

---

## 4. Product requirements

### User roles

**Transformation lead / reviewer (primary):** uploads files, reviews mappings, adjusts classifications, approves customer report.  
**Technical engineer:** investigates complex findings and source evidence.  
**Project manager (future):** views outstanding blockers and reporting status.

### Main user journey

1. Open TraceSync and select/create a project and upload cycle.
2. Upload Workbook A and Workbook B.
3. View validation summary and record counts.
4. Run reconciliation.
5. Review statuses and drill into original source messages.
6. Open Smart Blocker Radar and inspect potentially shared blockers.
7. Edit customer-facing description, action, owner (if known), disposition and recheck flag.
8. Approve the report set.
9. Export `.xlsx` and download it.
10. Optionally save the cycle for future comparison.

### Reconciliation statuses (do not conflate)

**Object match status:** `EXACT_OBJECT_MATCH`, `POSSIBLE_OBJECT_MATCH`, `TRANSFORMATION_ONLY`, `UPLOAD_ONLY`, `AMBIGUOUS`.  
**Finding comparison status:** `SAME_CATEGORY`, `DIFFERENT_CATEGORY`, `MULTIPLE_FINDINGS`, `NO_COMPARABLE_FINDING`, `NEEDS_REVIEW`.  
**Reviewer disposition:** `PENDING`, `INCLUDE`, `EXCLUDE`, `RECHECK`.  
**Approval state:** `DRAFT`, `APPROVED`.

Store these dimensions separately. An object can have an exact identity match and still require review because the error messages differ.

### Nonfunctional requirements

- Local-first demo; no dependence on internet for core matching/export.
- Processing should be responsive for workbooks of the supplied size; measure actual latency.
- Deterministic outputs given identical inputs and approved decisions.
- Safe handling of malformed workbooks and unexpected sheets.
- No arbitrary code execution from workbook content.
- Visible provenance and audit trail of manual overrides.
- Architecture extensible to new report layouts, projects and cycles.

---

## 5. Prescribed technology stack

| Concern | Choice | Rationale |
|---|---|---|
| UI | React 18+ / TypeScript / Vite | Fast interactive single-page app |
| UI styling | Tailwind CSS | Clean, consistent dashboard styling |
| Backend API | Python 3.12+ / FastAPI | Straightforward file uploads, parsing, reconciliation and typed APIs |
| Schemas | Pydantic v2 | Validated request/response models |
| Excel input | pandas + openpyxl | Read and normalize existing `.xlsx` files |
| Excel output | openpyxl | Preserve desired workbook structure and formatting |
| Persistence | SQLite + SQLAlchemy 2 / Alembic | Low-friction local demo with migrations |
| Production DB | PostgreSQL | Multi-project, multi-user persistence later |
| Matching | Python deterministic rules | Testable, explainable and offline |
| AI | Provider interface; optional approved LLM API | Optional explanations, never critical-path matching |
| Backend tests | pytest + httpx | Unit/integration API tests |
| Frontend tests | Vitest + React Testing Library | UI behavior tests |
| Packaging | Docker Compose | Reproducible demo |

**Important:** These are implementation recommendations, not preapproved internal technologies. Do not use external AI with internal data without permission. SQLite is sufficient for the initial solo demo; PostgreSQL can be adopted when deployment requirements justify it.

---

## 6. Proposed repository layout

```text
TraceSync/
  README.md
  docs/
    PROJECT_REFERENCE.md
    data-dictionary.md
    mapping-rules.md
    evaluation.md
  backend/
    pyproject.toml
    app/
      main.py
      core/config.py
      api/routes/{projects,uploads,reconciliation,findings,blockers,reports}.py
      schemas/{upload,reconciliation,finding,report}.py
      db/{base,session,models}.py
      services/
        importers/{base,transformation,upload_errors,customer_reference}.py
        normalization.py
        reconciliation.py
        message_linking.py
        blocker_radar.py
        report_export.py
        evaluation.py
        ai_explainer.py
      rules/{error_patterns,report_disposition}.py
    tests/{fixtures,unit,integration}/
    alembic/
  frontend/
    src/
      api/
      components/
      pages/{UploadPage,ReconciliationPage,FindingDetailPage,ReportPage}.tsx
      types/
      App.tsx
  docker-compose.yml
  .env.example
  .gitignore
```

Keep original sample workbooks in a **gitignored local data folder** unless company policy explicitly permits committing them. Never commit secrets, customer logs or generated customer reports.

---

## 7. Data model

Suggested relational tables (minimum viable schema):

### `projects`
`id`, `name`, `customer_code` (optional), `created_at`.

### `upload_cycles`
`id`, `project_id`, `cycle_label`, `status`, `created_at`.

### `source_files`
`id`, `cycle_id`, `file_role` (`TRANSFORMATION`, `UPLOAD`, `REFERENCE`), `original_name`, `sha256`, `uploaded_at`, `storage_path` (local-only). Unique hash per file/cycle as appropriate.

### `source_records`
`id`, `source_file_id`, `sheet_name`, `excel_row_number`, `record_kind`, `object_name_raw`, `object_name_normalized`, `object_type_raw`, `error_category_raw`, `error_message_raw`, `suggested_action_raw`, `raw_payload_json`.

### `objects`
`id`, `cycle_id`, `canonical_name`, `canonical_type` (nullable), `match_status`.

### `object_record_links`
`id`, `object_id`, `source_record_id`, `link_type`, `match_method`, `match_confidence_label` (`EXACT`, `CANDIDATE`, `MANUAL`). A source record may be linked to a parent object only when the linkage is justified.

### `findings`
`id`, `cycle_id`, `object_id`, `category_normalized`, `comparison_status`, `description`, `review_disposition`, `approved`, `customer_action`, `owner_label`, `recheck`, `reviewer_note`, `created_at`, `updated_at`.

### `finding_evidence`
`id`, `finding_id`, `source_record_id`, `evidence_role` (`TRANSFORMATION`, `UPLOAD_OBJECT`, `UPLOAD_DETAIL`, `REVIEW_NOTE`).

### `blocker_groups`
`id`, `cycle_id`, `blocker_type`, `shared_identifier`, `hypothesis`, `status` (`SUGGESTED`, `CONFIRMED`, `DISMISSED`).

### `blocker_group_findings`
`blocker_group_id`, `finding_id`.

### `review_events`
`id`, `finding_id`, `field_changed`, `old_value`, `new_value`, `changed_at`, `actor` (demo local user).

**Design constraint:** Store raw source records independently from normalized entities and human decisions. Never mutate original evidence when a reviewer changes a classification.

---

## 8. Parsing and normalization — detailed logic

### Step A: Inspect workbook schemas first

Build a CLI command `python -m app.scripts.inspect_workbooks <fileA> <fileB> <fileC>` (or a test utility) to print:
- sheet names, dimensions, header candidates, nonempty counts;
- first 5 sanitized example records per relevant sheet;
- duplicate object names, blank identifiers, mixed object types;
- any formulas, merged cells or layout-specific complications.

**Do not invent column names from this specification.** The coding agent must inspect the actual workbooks and write a data dictionary mapping source column headers to canonical fields before implementing adapters.

### Step B: Create per-workbook adapters

Each adapter returns `SourceRecord` objects with canonical fields and untouched raw payload. Use separate adapters for transformation `Detailed_LOG`, upload `Objects`, upload `Errors`, and customer reference `Error details`/`Recheck`. Treat `Summary` tabs as optional unless business requirements specify otherwise.

### Step C: Normalize object identifiers

For initial exact matching:
- convert values to strings safely;
- trim leading/trailing whitespace;
- normalize Unicode whitespace;
- uppercase where SAP identifiers are case-insensitive;
- preserve original identifier and object type;
- do not strip underscores, prefixes, suffixes or method/component delimiters arbitrarily.

Suggested canonical key: `(normalized_object_type, normalized_object_name)` where both exist; otherwise a **name-only candidate**, not automatically a confirmed semantic match. When a known parent-child object relationship is documented, add explicit mapping rules and tests.

### Step D: Associate upload `Errors` messages with upload `Objects`

Identify the real linkage fields by inspecting the workbooks. Join by stable identifiers when available; otherwise apply conservative, explicit object-name linking. Preserve unlinked log messages and flag them. One object may have many detailed messages; do not discard duplicates until their meaning is established.

### Step E: Error normalization

Map known error labels to canonical categories, e.g. `OBJ_LOCKED`, `NO_TLAYER`, `NO_TRANS_ROUTE`, `SAP_OB`, `NO_DEVC`, while retaining original labels. Only add synonym mappings supported by sample data or lead-approved rules. Unknown categories remain `UNKNOWN` and visible.

---

## 9. Reconciliation engine — deterministic core

### Algorithm outline

```python
# Pseudocode — adapt to verified workbook schemas
transformation = parse_transformation(file_a)
upload_objects = parse_upload_objects(file_b)
upload_messages = parse_upload_messages(file_b)

normalized_transformation = normalize(transformation)
normalized_upload = normalize(upload_objects)

linked_messages, orphan_messages = link_messages_to_objects(
    normalized_upload, upload_messages
)

object_matches = reconcile_object_identity(
    normalized_transformation, normalized_upload
)

findings = []
for match in object_matches:
    findings.extend(compare_findings_and_preserve_evidence(match, linked_messages))

findings.extend(create_review_cases_for_orphan_messages(orphan_messages))
blocker_candidates = detect_shared_blockers(findings)

persist_without_changing_source_evidence(findings, blocker_candidates)
```

### Matching precedence

1. Exact normalized object **type + name** where both are available.
2. Exact normalized name with missing/incompatible type: flag as candidate/review, unless verified project rules allow automatic acceptance.
3. Documented parent-component linkage (e.g. class vs method), always show evidence and rule.
4. Other fuzzy similarities: suggestions only; never silently approve.

### Error comparison

For each matched object, compare **sets/multisets of normalized error categories and message evidence**, not a single error string. Preserve multiple messages. Distinguish: same category, changed category, multiple messages, and missing comparable evidence. Do not assume a changed error means an automation failure; it could reflect changed phase or environment.

### Inclusion in customer report

**Do not hard-code:** `all upload errors -> customer report`. The existing report is curated. Until the lead confirms inclusion/exclusion rules, default to `PENDING` review. You may prepopulate *suggested* dispositions, but do not export unapproved decisions as final.

### Example tests

- Same object and same category in both files -> exact object match + same category.
- Same object but different category -> exact object match + changed category, needs review.
- Upload-only object -> upload-only, not automatically an automation defect.
- Transformation-only object -> transformation-only, not automatically a missed change.
- Same object with 3 upload messages -> one object with 3 preserved evidence records.
- Blank or malformed object name -> validation issue; never fabricate a match.
- Duplicate input file -> detect and warn; avoid accidental duplicate findings.

---

## 10. Signature feature: Smart Blocker Radar

### User value

Show when multiple findings **might** stem from the same missing prerequisite, transport request or object-level blocker. This reduces repeated investigation without pretending to have proven root cause.

### Initial grouping rules

1. `NO_TLAYER`: extract the exact missing transport-layer identifier (e.g. `ZD87`) from supporting messages; group by `(blocker_type, layer_id)`.
2. `OBJ_LOCKED`: extract transport/request identifier where available (e.g. `LE1K9A7GHH`); group by `(blocker_type, transport_id)`.
3. Multiple messages on one object: show them as a consolidated object investigation card; **do not** automatically call this a cross-object shared blocker.

Do not group solely because two messages have the same generic category. A valid shared-blocker card requires a supported shared identifier or a reviewer-confirmed relationship.

### Radar card

- Blocker hypothesis (plain language)
- Shared identifier and error type
- Number of **distinct affected objects** (not raw log rows)
- Linked objects and messages
- Why grouped (explicit rule)
- Suggested next investigation step
- `Suggested / Confirmed / Dismissed` reviewer control

### Example card

> **Potential shared blocker: Missing transport layer ZD87**  
> Evidence: multiple upload messages explicitly reference `ZD87` (only show this card if data confirms multiple affected objects).  
> Suggested check: verify target-system transport-layer configuration.  
> Status: Suggested; reviewer confirmation required.

### AI enhancement (optional)

The LLM receives a **bounded, sanitized evidence bundle**, never the whole workbook by default. It returns JSON with `plain_language_explanation`, `possible_cause`, `suggested_check`, `uncertainties`, `source_record_ids`. Validate schema and citations; reject references to nonexistent source IDs. AI is never allowed to change `review_disposition`, `approved` or exported source facts.

**Fallback:** When AI is unavailable, show deterministic group explanation templates. The live demo must work without network access.

---

## 11. API contract — initial endpoints

All routes under `/api/v1`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/projects` | Create project |
| GET | `/projects` | List projects |
| POST | `/projects/{project_id}/cycles` | Create upload cycle |
| POST | `/cycles/{cycle_id}/files` | Multipart upload; role `TRANSFORMATION` or `UPLOAD` |
| GET | `/cycles/{cycle_id}/files` | Uploaded files and validation status |
| POST | `/cycles/{cycle_id}/reconcile` | Run idempotent reconciliation |
| GET | `/cycles/{cycle_id}/summary` | Counts, timings, review status |
| GET | `/cycles/{cycle_id}/findings` | Paginated/filterable findings |
| GET | `/findings/{finding_id}` | Evidence-backed finding detail |
| PATCH | `/findings/{finding_id}` | Update disposition, comments, actions |
| GET | `/cycles/{cycle_id}/blockers` | Suggested blocker groups |
| PATCH | `/blockers/{blocker_id}` | Confirm/dismiss group |
| POST | `/cycles/{cycle_id}/reports/preview` | Preview approved export rows |
| POST | `/cycles/{cycle_id}/reports/export` | Generate and download XLSX |
| GET | `/health` | Health check |

Use Pydantic schemas, consistent validation errors, pagination for findings, and clear HTTP status codes. Never expose arbitrary filesystem paths in API responses. Validate file extension, size and workbook parseability. Limit CORS to the local frontend origin for the demo.

---

## 12. Frontend UX specification

### Page 1 — Upload workspace

- Project and cycle selector.
- Two clearly labeled file inputs: **Initial Transformation Report** and **Post-Upload Errors Report**.
- Validation results: sheets found, rows extracted, unique objects, warnings.
- `Run Reconciliation` action; loading/progress and error states.

### Page 2 — Reconciliation dashboard

- KPI cards: transformation objects, upload objects, exact matches, candidate matches, upload-only, transformation-only, review pending.
- Searchable, filterable table: object, object type, transformation finding(s), upload finding(s), match status, reviewer disposition.
- Clicking a row opens side-by-side source evidence with sheet and row provenance.
- Clear distinction between **matching confidence** and **business disposition**.

### Page 3 — Smart Blocker Radar

- Cards for verified-identifier groups; number of distinct objects; explanatory evidence.
- Expand group to see affected objects and messages.
- Confirm/dismiss action with audit trail.
- AI explanation button only if enabled; deterministic fallback otherwise.

### Page 4 — Customer report review/export

- Table of approved `INCLUDE` and `RECHECK` findings.
- Editable customer-facing action/comments.
- Export preview counts, missing required fields and warnings.
- Download Excel with sheets aligned to `Error details`, `Recheck`, and optionally `Summary` if the layout is agreed.

### Design guidelines

Use a restrained enterprise design: light background, clear typography, high contrast, compact tables, visible empty/error states, no flashy AI claims. Avoid unexplained acronyms in UI; add tooltip explanations for `OBJ_LOCKED`, `NO_TLAYER` and other categories. Every AI-generated sentence should be visually labeled as a suggestion.

---

## 13. Excel export contract

The reference workbook is a **format and decision benchmark**, not an input to normal processing.

1. Inspect actual headers, column ordering, merged cells, validations and styles in `ZF_LE1_Upload_Errors.xlsx`.
2. Define a canonical export mapping in `docs/data-dictionary.md`.
3. Generate an `Error details` sheet with reviewer-approved entries, preserving meaningful source details.
4. Generate a `Recheck` sheet with reviewer-marked recheck items.
5. Generate a simple `Summary` sheet only if requirements are clear; do not falsely claim to reproduce a functioning pivot table without implementing one.
6. Include optional `Audit` sheet **only if acceptable to the customer**; otherwise keep audit metadata internally.
7. Ensure workbook opens in Excel, has readable widths, frozen headers and appropriate filters.
8. Test row counts, column mapping, data types, object names and source evidence references.

Never export an unreviewed AI suggestion as a confirmed customer action. When required customer-facing fields are unknown, use explicit placeholders for reviewer completion rather than inventing owners, priorities or fixes.

---

## 14. Validation and business metrics

### Evaluation dataset strategy

Use the supplied customer workbook as a **reference**, after confirming with the transformation lead that its classifications are correct. Keep it out of the normal pipeline. Avoid training or coding exact object-specific rules derived from the reference and then claiming independent accuracy on the same sample.

### Metrics

- **Object match precision:** Correct automatically accepted matches / all automatically accepted matches.
- **Object match recall:** Correct automatically accepted matches / all verified matchable pairs.
- **Customer report precision:** Correctly included generated findings / all generated included findings.
- **Customer report recall:** Correctly included generated findings / all findings that should be included.
- **Review burden:** Number and percentage of cases flagged for human review.
- **Processing time:** Time from upload to draft findings and report preview.
- **End-to-end time:** Processing + human review + final export, compared with actual manual baseline.

### Time savings

`time_saved_pct = 100 * (manual_minutes - assisted_minutes) / manual_minutes`

Only report this if both times are measured on comparable work. The questionnaire's 80% matching and 50% time reduction are **targets**, not results.

### Acceptance test suite

- Parse both sample workbooks and preserve source counts.
- Reconcile known objects (`ZRMMIMPORT_2`, `ZSLO_COND_SEND`, `Z_CL_HUM`) with expected evidence and appropriate review status.
- Correctly handle unmatched and duplicate records.
- Ensure no missing source-record links for exported findings.
- Verify that an unapproved finding cannot appear as an approved action.
- Verify blocker grouping requires actual shared identifiers.
- Verify export opens and retains approved reviewer edits.
- Verify core workflow works with AI disabled and internet unavailable.

---

## 15. Security and governance

- Obtain permission to use internal/customer workbooks in development and demonstrations.
- Prefer local execution and anonymized/sanitized screenshots where appropriate.
- Do not upload workbooks to public repositories or third-party AI APIs without authorization.
- Validate uploads and sanitize file names; impose file-size limits.
- Do not execute workbook macros or evaluate arbitrary formulas.
- Keep secrets in environment variables; commit `.env.example`, not `.env`.
- Log metadata and errors, not full sensitive workbook contents.
- Retain source provenance and reviewer audit trail.
- Production authentication, role-based access, retention policies and infrastructure approvals remain future deployment requirements.

---

## 16. Build plan — sequential Codex milestones

### Milestone 0 — Repository and workbook discovery

**Goal:** Establish the true input/output schemas before implementing business logic.

Tasks:
1. Initialize repository, backend/frontend projects and `.gitignore`.
2. Inspect all seven tabs across the three supplied workbooks.
3. Write `docs/data-dictionary.md` listing exact columns, inferred types, null patterns, object identifiers, join-key candidates and ambiguities.
4. Write `docs/mapping-rules.md` with verified rules and clearly marked unknowns.
5. Create small sanitized test fixtures from approved data or synthetic equivalents.

**Done when:** Schema documentation is accurate and no matching rule relies on guessed columns.

### Milestone 1 — Backend skeleton and ingestion

Tasks:
1. FastAPI app, Pydantic schemas, SQLAlchemy models and Alembic migration.
2. Project/cycle creation endpoints.
3. Upload endpoints with file validation and hash tracking.
4. Implement adapters for transformation and upload sheets.
5. Persist raw records and import warnings.
6. Unit tests for parsing and normalization.

**Done when:** Both source files upload successfully and API returns verified counts and provenance.

### Milestone 2 — Reconciliation engine

Tasks:
1. Exact object type/name matching and conservative name-only candidates.
2. Link detailed upload errors to objects using validated keys.
3. Compare categories/messages without discarding many-to-one evidence.
4. Persist findings and match statuses.
5. Handle duplicates, orphan messages, conflicting categories and missing values.
6. Add deterministic unit tests for all key scenarios.

**Done when:** Known examples reconcile correctly, with uncertain cases flagged rather than silently resolved.

### Milestone 3 — Reviewer UI and persistence

Tasks:
1. React upload page and summary cards.
2. Reconciliation table with filters and search.
3. Evidence drawer showing both reports, sheet names and row numbers.
4. Editable disposition, action, note and recheck status.
5. Save changes and audit events via API.

**Done when:** A reviewer can inspect and approve a finding end to end.

### Milestone 4 — Customer report generation

Tasks:
1. Map approved finding fields to reference report structure.
2. Generate `Error details` and `Recheck` sheets.
3. Validate required fields and report preview.
4. Export and download workbook.
5. Compare generated workbook with verified reference; document differences.

**Done when:** Reviewer can generate a usable Excel report without manually copying rows between files.

### Milestone 5 — Smart Blocker Radar

Tasks:
1. Implement transport-layer and transport-lock identifier extraction with regexes based on observed messages.
2. Group findings by explicit shared identifier, counting distinct objects.
3. Show grouping rationale and source evidence.
4. Add confirm/dismiss controls and audit events.
5. Test false-positive avoidance.

**Done when:** At least one real supported group is demonstrated if the data contains one; otherwise show a clearly labeled synthetic example and do not misrepresent it as real.

### Milestone 6 — Optional AI interpretation

Tasks:
1. Define `AIExplainer` interface with disabled/local-template mode and optional approved provider mode.
2. Build a structured explanation request from selected evidence only.
3. Require typed JSON output with source IDs and uncertainty.
4. Validate references; fall back on deterministic explanation when unavailable.
5. Show AI text as a suggestion, never as a verified conclusion.

**Done when:** AI helps explain a complex finding while the workflow remains usable with AI off.

### Milestone 7 — Evaluation and demo hardening

Tasks:
1. Create `docs/evaluation.md` with measured counts, precision/recall and timing.
2. Run integration tests using copies of the provided workbooks.
3. Test report generation and re-import of output.
4. Prepare reliable local start scripts and demo fixtures.
5. Rehearse a 6–7 minute live walkthrough with network disabled.
6. Document limitations and next-cycle roadmap.

**Done when:** The complete upload → reconcile → review → export workflow succeeds repeatedly without manual code edits.

### Priority if time is short

**Must ship:** Milestones 0–4.  
**Signature enhancement:** Milestone 5.  
**Optional:** Milestone 6.  
**Always do:** Essential tests and rehearsal from Milestone 7.

---

## 17. Implementation work packages

### Dataset discovery

Inspect all three source/reference workbooks and document actual headers, types, row counts, missing fields, linkage candidates and ambiguity. Complete schema discovery before implementing matching. Record questions the files cannot answer. Keep source data local and uncommitted.

### Core backend

Use the verified data dictionary to guide backend ingestion and reconciliation. Preserve raw evidence, compare object identities conservatively and keep error comparison separate. Cover exact, ambiguous, unmatched and multiple-message cases with tests. Business dispositions require verified rules; record actual test results.

### Review and export

Provide source-provenance inspection, editable reviewer decisions and actions, explicit approval and a reviewable Excel export. Use the customer workbook only as a format/evaluation reference. Keep unknown business rules configurable and never invent customer actions.

### Smart Blocker Radar

Group findings only when actual upload messages support shared identifiers. Show distinct affected objects, grouping evidence and confirm/dismiss controls. Verify both valid grouping and rejection of same-category-only false positives. An LLM must not create grouping facts.

### Verification and demo preparation

Exercise the full workflow against approved samples and record actual counts, processing time, reconciliation metrics and report differences. Maintain exact local commands, a seven-minute walkthrough, backup setup instructions and honest limitations in the demo guide. Do not claim unmeasured accuracy or time savings.

---

## 18. First demo — 15-minute presentation structure

| Time | Segment | Key proof |
|---|---|---|
| 0:00–1:30 | Current manual process | Objects and errors manually mapped across reports |
| 1:30–3:00 | TraceSync concept | End-to-end workflow and differentiator |
| 3:00–4:00 | Architecture | Deterministic matching + human review + optional AI |
| 4:00–10:30 | Live demo | Upload → reconcile → Radar → review → export |
| 10:30–12:00 | Results | Measured accuracy, review burden and timings |
| 12:00–13:30 | Deployment and scale | Adapter design, project/cycle storage, security |
| 13:30–15:00 | Limitations and roadmap | What works now vs future improvements |

### Suggested live demo sequence

1. Show two input workbooks, briefly explain their roles.
2. Upload them in the browser; display import validation and counts.
3. Show exact matched object and upload-only object with original source messages.
4. Show a changed/multiple-message case requiring review.
5. Open Smart Blocker Radar and show an evidence-backed group.
6. Approve/edit a customer-facing action and mark a recheck.
7. Generate and open the final Excel report.
8. Show actual benchmark results and known limitations.

### Five likely panel questions

- **Why AI?** Matching and export are deterministic; AI only assists interpretation of ambiguous evidence.
- **How do you prevent wrong customer reports?** Evidence traceability, reviewer approval and explicit unknown statuses.
- **How do you prove impact?** Compare against verified manual reference and measure end-to-end human time.
- **What makes this novel?** Object-and-error reconciliation plus shared-blocker grouping and future cycle memory.
- **Can it scale?** Modular import adapters, persistence by project/cycle, indexed queries and background jobs later.

---

## 19. Unknowns to validate with transformation lead

1. What exact rule determines inclusion in the customer report?
2. How are manually added status/comments created, and at what point in the process?
3. What is the authoritative relationship between transformation findings and expected code changes?
4. Are object types or SAP parent-child relationships necessary for reliable matching?
5. What do `Out of scope`, `OK`, `Customer Action` and `Recheck` mean in this workflow?
6. What makes two errors one customer action versus two independent actions?
7. What should happen to upload-only and transformation-only objects?
8. Which customer-facing fields are mandatory and who supplies ownership?
9. Is the supplied customer workbook a validated ground truth?
10. What data and AI services are approved for local development and demo?

**Engineering instruction:** Record answers in `docs/mapping-rules.md` as versioned, testable rules. Until answered, favor visible review states over invented certainty.

---

## 20. Definition of done and change management

### Prototype is ready when

- The app runs locally from documented commands.
- It parses the provided transformation/upload workbooks.
- It matches objects and connects error evidence accurately enough to support review.
- It exposes unmatched/ambiguous cases instead of hiding them.
- It permits human corrections and preserves audit history.
- It exports a customer-ready workbook from approved findings.
- Smart Blocker Radar is evidence-backed and does not assert unproven root causes.
- At least one end-to-end integration test passes.
- Measured metrics and limitations are documented.

### Adaptability rules

- New report formats -> add importer adapter, not rewrite reconciliation.
- New business classifications -> add versioned decision rules, not hard-coded UI branches.
- New AI provider -> replace AI adapter, not core workflow.
- More projects/cycles -> extend persistence and permissions, not object matching logic.
- Jira integration -> consume approved findings, never create tickets from unreviewed AI suggestions.

### Final product statement

**TraceSync transforms scattered automation evidence into traceable, reviewable customer actions. It reduces repetitive object/error mapping today and establishes a foundation for understanding recurring blockers across future upload cycles.**
