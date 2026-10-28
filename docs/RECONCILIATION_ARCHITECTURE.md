# Reconciliation architecture and implementation plan

Version 0.4, 2026-10-28. **The 0.9A pure object matcher and immutable identity contracts are implemented.** Snapshot loading, attribution/comparison, derived tables, endpoints and review controls remain proposed. The separate 0.8C layout compatibility is implemented without a migration; see [INGESTION_LAYOUTS.md](INGESTION_LAYOUTS.md). Read alongside the [implemented matcher contract](OBJECT_MATCHER.md), [rules](RECONCILIATION_RULES_SPEC.md), [matrix](MATCHING_DECISION_MATRIX.md), [questions](RECONCILIATION_OPEN_QUESTIONS.md) and [cross-dataset findings](CROSS_DATASET_FINDINGS.md).

## 1. Existing system and gaps

| Area | Inspected implementation | Implication |
|---|---|---|
| Projects and cycles | `Project`, `Cycle`; project FK and ingestion state `empty/partial/complete` | Derive project from the selected cycle; ingestion completion does not mean reconciliation or review completion |
| Workbook metadata | `Workbook`, unique `(cycle_id, role)`, role `transformation/post_upload`, SHA-256, source filename, counts and warnings | Capture the exact two workbook IDs/hashes; retain current upload conflict/idempotency behavior |
| Source evidence | Three independent row models with UUID, workbook FK, worksheet/Excel row, raw payload and raw/normalized identifiers | Reference these rows directly; preserve duplicates and manual/tool distinctions |
| Parsing | Separate adapters; blank identities and repeated keys retained; formulas/error cells rejected; `S.No` integer/blank | Engine receives trusted structure but must still handle identity/semantic uncertainty |
| Supported source layouts | Explicit selection/validation now accepts D1 and D2 through the same APIs; raw-layout absent fields remain null/sparse | Persisted source inputs are ready for future matching; no schema, source replacement or reconciliation was added |
| Normalization | Shared whitespace/case normalization, preserving original values and punctuation | Record normalization version and risk flags; do not silently replace persisted raw fields |
| Migrations | `0001_create_projects`, `0002_add_ingestion` | New derived tables would be later Alembic revisions, not startup table creation |
| Evidence API | Paginated workbook metadata and three cycle-scoped evidence lists | Load all rows in the backend, not through a visible frontend page |
| Evidence Explorer | Three read-only datasets, 25-row pages, current-page filtering, detail dialog, workbook/sheet/row and IDs, raw text/payload, normalized values, imported manual section | Reuse presentation principles; no existing link-confirmation or source-edit API exists |
| Reconciliation route | Existing placeholder reachable by direct route, hidden from current navigation | Replace/unhide only in a later authorized UI stage; make no navigation or screen changes now |
| Test isolation | pytest temporary databases; owned browser API 8001/UI 5174 and disposable databases | Extend existing safeguards; normal API 8000/UI 5173 and local data remain outside acceptance tests |

Sources: [models](../backend/app/db/models.py), [ingestion](../backend/app/services/ingestion.py), [schemas](../backend/app/schemas/ingestion.py), [migration](../backend/alembic/versions/0002_add_ingestion.py), [API routes](../backend/app/api/routes/workbooks.py), [Evidence Explorer](../frontend/src/pages/EvidenceExplorerPage.tsx), [evidence details](../frontend/src/components/evidence/EvidenceDetail.tsx) and [test isolation](TEST_DATA_ISOLATION.md).

The current schema does **not** persist original workbook bytes, a SAP system/client identity, a structured upload error-category/code contract, shared-TR inventory, imported annotation authors/timestamps, reconciliation runs or review/audit decisions. These are limits, not fields to infer from filenames, sequence numbers or manual comments.

### Source-layout compatibility and future run metadata

L-01/L-02 are implemented for the two known layouts: exact worksheet aliases/pairs plus required-header validation, null/sparse raw fields and ambiguous-pair rejection. Generic `Sheet1`/`Sheet2` names alone are insufficient. Future reconciliation profile metadata can add versions/context capabilities; it is not an implemented run/entity contract yet.

D2 does not supply `Status`, `Re Upload` or manual status/comments. The compatible adapter leaves the existing nullable fields null, omits absent payload keys and records a missing-column warning. Do not manufacture `UPLD_ERROR`, add columns to originals or enrich source records from the reference report. The reference remains outside normal matching input; its alternative `Error log`/missing recheck section concerns later reference/output format agreement.

Existing persisted `sheets_found`, actual source worksheet names and original payload headers allow a later snapshot to derive a source-layout profile and supplied-field map. Freeze that derived interpretation/version in the future run manifest; do not pretend it is a historically recorded importer version. Compatibility uses existing nullable models and warnings with no migration or response-field addition; persisted versioned run metadata remains future work.

## 2. Component boundaries

```mermaid
flowchart LR
    S[Existing persisted source rows] --> I[Cycle and input snapshot]
    I --> O[Object comparison]
    O --> A[Message attribution]
    A --> C[Error evidence suggestions]
    C --> P[Atomic derived run persistence]
    P --> V[Reconciliation Review API and screen]
    V --> D[Separate decisions and audit history]
    D --> V
```

Source rows/read APIs and the pure object-comparison component exist today. Only object comparison is implemented from the derived pipeline above; no production snapshot loader connects it to the application yet. It accepts immutable identity-only snapshots and returns frozen results, without database/file/network operations. Persistence and HTTP orchestration remain outside it; no dependency, queue, Docker setup or external AI was added.

| Component/path (status stated below) | Responsibility | Must not do |
|---|---|---|
| `backend/app/services/reconciliation/domain.py` (implemented) | Frozen `ObjectRecord`, `EvidenceReference`, `ObjectCase`, counts/result and four object outcomes | Import the application entry point, create a DB engine or read files implicitly |
| `.../object_matching.py` (implemented) | Check supplied normalization, group reliable typed keys, preserve repeats, quarantine unsafe rows and report conflicts/one-sided cases | Match missing types by name, infer customer scope, compare errors or choose among conflicting manual notes |
| `.../attribution.py` | Explicit subject links, potential contexts and unattributed queue | Forward-fill subjects or equate a component with a parent |
| `.../correspondence.py` | Evaluate enabled evidence rules and preserve unpaired/unknown evidence | Use manual annotations/reference report as prediction inputs or claim remediation success |
| `.../rules.py` | Immutable rule registry, versions, supported profiles, positive/negative predicates and enabling state | Embed customer-specific object names, undocumented category aliases or D1 block rules as a universal default |
| `.../snapshot.py` | Read one cycle's source pair and rows, validate source coverage and normalize under the recorded version | Depend on the uploaded XLSX still existing or on frontend filters |
| `.../runs.py` | Idempotent orchestration, timing and transactionally published results | Mutate source records or overwrite prior review decisions |
| `.../reviews.py` | Validate targeted decisions, revisions and atomic audit events | Treat a confirmation as approval of unrelated links/actions |
| Future `schemas/reconciliation.py`, routes and frontend service/types | Explicit read/write contracts and consistent error handling | Reimplement matching in TypeScript or change existing evidence endpoints |

Only `domain.py`, `object_matching.py` and package exports exist in the reconciliation package; other component paths remain proposals. Known ingestion layouts are implemented; future formats still need an explicit contract. Format-specific block/pattern rules require Q-02/Q-04/Q-06. D2's increasing, gapped ordinals invalidate a shared reset-at-1 strategy; its terminal candidates also fail upload-key coverage. Automatic context remains disabled until each profile has a validated contract. The object matcher uses in-memory typed-key/name indices without all-to-all comparison. Future APIs must paginate results without truncating engine evidence coverage.

## 3. Implemented identity contract and proposed extensions

The implemented `ObjectRecord`, `EvidenceReference`, `TypedObjectKey`, `ObjectCase`, `ReconciliationResult` and count structures are documented in [OBJECT_MATCHER.md](OBJECT_MATCHER.md). They accept identity/provenance only, preserve every contributing row, and expose `SHARED`, `TRANSFORMATION_ONLY`, `UPLOAD_ONLY`, `NEEDS_REVIEW`. Missing types produce no name-only candidate edges. The following broader contracts remain future design; proposed names/fields do not override the implemented identity contract.

| Structure | Minimum content |
|---|---|
| `InputSnapshot` | Project/cycle IDs, two workbook IDs/roles/hashes, source-layout profiles/versions, supplied-field maps/context capabilities, row counts/warnings, immutable source records, engine/rule/normalization versions and effective configuration |
| `EvidenceRef` | Source kind plus source UUID, workbook ID, worksheet and Excel row; raw and normalized values available through source lookup |
| `ObjectCase` | Stable semantic key, proposed normalized name/type where present, source membership, object status, normalization/conflict reasons and counts |
| `ObjectCandidate` | Two distinct source-group cases, candidate/conflict kind, rule/reasons and supporting evidence refs; does not merge them |
| `MessageAttribution` | Upload-message ref, target object case or no target, `EXPLICIT/POTENTIAL/UNATTRIBUTED`, `SUBJECT/CONTEXT`, rule and reasons |
| `ErrorComparison` | Transformation ref, upload-message ref where a pair is justified, comparison outcome, rule, supporting attribution, captured identifiers/spans and uncertainties |
| `ReviewDecision` | Typed target, explicit state, supporting evidence, note, revision, recorded actor and timestamp; optional scoped customer-action draft/report disposition |
| `RunSummary` | Input manifest, unique source counts, group/edge counts separately, attribution and comparison coverage, rule limitations, timing and review counts |

Use `(source kind, source UUID)` to identify evidence because there are three source tables. Do not use row number alone or assume UUIDs from different tables form one foreign-key space. Object cases contain T/U source groups; technical messages live in the run-wide message pool and reach cases through attribution links.

In the implemented matcher, an unsafe record gets its own deterministic review ID from the supplied identity/provenance; a stable source UUID is used when supplied and never fabricated. Eligible typed groups retain every T/U reference. Conflicts and incomplete opposite-side evidence produce review flags without candidate edges. A later candidate/review model could preserve rejected suggestions with separate decisions; none of those relationships or decisions exists in 0.9A.

## 4. Minimum proposed relational structures

Reuse `projects`, `cycles`, `workbooks`, `transformation_findings`, `upload_objects` and `upload_errors`. Do not rewrite them into the original reference's hypothetical `source_records` table.

Six derived tables support 0.9C; two review tables are added in 0.9D. They separate three different relationships and keep actual source FKs enforceable. This is the proposed minimum here, not a requirement to add a generic workflow framework.

| Proposed table | Fields and constraints |
|---|---|
| `reconciliation_runs` | UUID PK, cycle FK, source workbook FKs, source hashes/count/profile/field-availability manifest, input fingerprint, engine/rule/normalization versions, effective config, `COMPLETED/FAILED`, start/end UTC timestamps, elapsed duration, summary/warning JSON and safe failure code |
| `reconciliation_objects` | UUID PK, run FK, stable case key unique within run, normalized type/name nullable, source-presence/object status, reasons/risk flags; automatic case contents immutable |
| `reconciliation_evidence` | UUID PK, run FK, source-kind discriminator and exactly one FK to a transformation finding, upload-object record or upload-error message; optional object-case FK only for T/U membership; comparison coverage/reasons for otherwise unpaired evidence |
| `reconciliation_object_candidates` | UUID PK, run FK, left/right object-case FKs, candidate/conflict kind, rule ID/version and reason/evidence references; unique edge, no self-links |
| `reconciliation_attributions` | UUID PK, run FK, upload-message evidence FK, nullable object-case FK, level, relationship kind, rule/reasons, optional observed range/anchor refs; target is null only for an unattributed result |
| `reconciliation_correspondences` | UUID PK, run FK, transformation-evidence FK, upload-message evidence FK, relevant attribution FK, pair outcome, rule/reasons and captured identifier/span metadata; unique rule/pair result |
| `reconciliation_review_decisions` | UUID PK, run FK, exactly one typed target FK (object case, object candidate, attribution, correspondence or evidence), relationship state, optional report disposition/action draft and its explicit evidence scope, note, revision, recorded actor/UTC updated timestamp; unique current decision per target |
| `reconciliation_review_events` | UUID PK, decision/run FKs, revision, before/after decision snapshots, operation, recorded actor/UTC timestamp; append-only, unique decision/revision |

Implementation details to preserve:

- **Source references:** use three nullable source-FK columns plus a CHECK that exactly one is non-null and agrees with source kind. Use per-kind unique indexes for `(run_id, source_record_id)`. This avoids an unenforceable generic `source_record_id` FK. Review target FKs use the same exactly-one-target principle.
- **Scope:** all derived rows carry `run_id`. Composite same-run foreign keys should prevent links to another run's cases/evidence/decisions. Before publication, validate source membership against the run's two workbook FKs and cycle, including role. No request may attach arbitrary evidence from another cycle.
- **Retention:** restrict deletion of referenced source/run rows. No deletion feature or automatic retention policy is proposed now. Do not cascade a rerun into old decisions.
- **Attribution cardinality:** one message has either one automatic explicit subject target, one or more potential targets, or an unattributed result. Several physical `Objects` rows behind one key are one target group. A context relation never becomes subject identity merely because reviewed.
- **Unpaired evidence:** do not fabricate correspondence rows with unrelated or null “matches.” Derive no-pair/upload-only/insufficient outcomes from retained evidence, coverage flags and available attribution/rules. Store only justified pair comparisons. A different-error comparison is evidence contrast, not a claim the two errors are equivalent.
- **Review evidence scope:** an action draft can refer to a particular source finding/comparison and selected supporting evidence; the object is not forced to have exactly one customer action. Final action aggregation and report approval remain pending Q-08 and a later reporting milestone.
- **Provenance:** keep workbook/sheet/row and raw content authoritative in existing source tables. New reason/capture metadata references the source and exact text span; do not copy modified “raw” messages into derived tables as replacements.
- **Indexes:** run/cycle, run/status, object/evidence membership, typed target and source-reference uniqueness; no speculative production indexing or source-table refactor in 0.9A.

A review decision's customer fields remain drafts. `PENDING/INCLUDE/EXCLUDE/RECHECK` are report dispositions, not relationship states or access decisions. Do not add an automatic export approval or inferred access field. BR-001 remains a reporting requirement for reviewed out-of-scope objects; automatic exclusion based on that label is prohibited.

## 5. Input snapshots, deterministic reruns and failure handling

1. Require a known cycle and both ingested roles. Empty datasets are allowed, missing roles are not. Read the exact IDs/hashes, all evidence and warnings into a consistent snapshot; verify count/row membership integrity.
2. Compute a canonical fingerprint from cycle ID, both source IDs/hashes, resolved layout-profile versions/field availability and effective engine/rule/normalization versions/configuration. Manual decisions are excluded from engine inputs. Missing field, supplied blank and supplied label must remain distinguishable. Old imported normalized values can be checked against the chosen normalization version; a mismatch becomes a limitation/error requiring review, not a silent source update.
3. Reuse an existing completed run with that fingerprint. It retains its decisions and returns `reused: true`. Different input/rule/config creates a new immutable run; no automatic decision carry-forward.
4. For these dataset sizes, use a synchronous request with a UI loading state. Compute pure results before publishing; no queue or persisted `RUNNING` job is required initially. Measure elapsed processing time in implementation.
5. Publish the completed run and all derived rows in one transaction. Use a uniqueness constraint/index on completed `(cycle_id, input_fingerprint)`; if two requests race, one transaction wins and the other rolls back/reuses it. No partial result set becomes readable.
6. On failure, roll back derived results. A separate `FAILED` attempt may retain only safe diagnostic metadata with its own run UUID; it has no visible result rows and does not occupy the completed-fingerprint uniqueness key. A retry can create another attempt. Do not log customer messages or traceback-bearing source content.
7. Save decision changes and audit events together. `expected_revision: 0` creates a decision; subsequent writes must match its current revision. A stale write returns 409 and saves neither a decision change nor an event. Existing automatic results remain immutable.

The same manifest/versions must produce the same semantic groups, edges, reason codes and evidence order; DB-generated UUIDs and timestamps are not expected to repeat. Summaries must distinguish source rows, typed groups, ambiguous cases, candidate edges and human-confirmed outcomes. Candidate fan-out must not inflate record counts.

## 6. Proposed API contracts

**None of these endpoints exists yet.** All paths are under `/api/v1`; existing ingestion/evidence routes remain unchanged. Reuse typed Pydantic schemas, reject unknown write fields and preserve the current safe error envelope `{error: {code, message}, request_id}`. No filesystem paths are exposed.

| Method and path | Proposed contract |
|---|---|
| `POST /cycles/{cycle_id}/reconciliation-runs` | Request expected transformation/post-upload workbook IDs and supported rule-set version; compute/store or reuse a completed run. Return 201 new / 200 reused, run manifest/versions/limitations/summary and `reused` |
| `GET /cycles/{cycle_id}/reconciliation-runs` | Paginated run history including failed metadata, completion state and timestamps; no inferred “latest approved” run |
| `GET /reconciliation-runs/{run_id}` | Project/cycle, source manifest, rule versions/configuration, automatic counts, separate review counts and coverage/limitations |
| `GET /reconciliation-runs/{run_id}/objects` | Paginated object cases; filters for object status, review state and literal object-name search; server totals reflect filters |
| `GET /reconciliation-objects/{object_id}` | Case metadata, provenance/counts, candidate links and review state; do not embed unbounded evidence arrays |
| `GET /reconciliation-runs/{run_id}/evidence` | Paginated typed source evidence with full original fields/provenance; optional object/source-kind/unpaired filters. Object filter returns direct members and justified attributions, with link level/kind shown; potential links are labeled |
| `GET /reconciliation-runs/{run_id}/attributions` | Paginated explicit/potential/unattributed results with source/target refs, reasons, automatic level and separate review state |
| `GET /reconciliation-runs/{run_id}/correspondences` | Paginated pair comparisons, evidence refs, rule/capture metadata, uncertainties and review state; unpaired evidence remains accessible through evidence filters |
| `GET /reconciliation-runs/{run_id}/reviews` | Paginated current decisions/notes, filterable by typed target |
| `POST /reconciliation-runs/{run_id}/review-decisions` | Submit typed target, expected revision, explicit state/note and optional scoped action draft/report disposition. Validate evidence/run scope and field combinations; create/update decision plus event atomically |
| `GET /reconciliation-runs/{run_id}/review-events` | Paginated audit history with optional target/decision filter; no event editing/deletion |

Lists use `{items, total, limit, offset}`, default limit 50, maximum 200, nonnegative offset, and a deterministic documented tie-break order. The frontend can request 25 rows as it already does for evidence. Original evidence routes currently have no global search: the proposed reconciliation name search is a **new** contract, not a claim that Evidence Explorer supports it today.

Each evidence item is returned once per query by typed source identity. If several relationships justify its appearance, include their references/levels together instead of repeating the source row. Pagination totals count those unique source records, not join edges.

Fictional run request shape:

```json
{
  "expected_sources": {
    "transformation_workbook_id": "11111111-1111-4111-8111-111111111111",
    "post_upload_workbook_id": "22222222-2222-4222-8222-222222222222"
  },
  "rule_set_version": "reconciliation-v1"
}
```

The server resolves source hashes and versions from validated state, rather than trusting client-provided raw records or SQL-like filters. A typed evidence response contains `source_kind`, `source_record_id`, workbook/role/sheet/Excel row, raw/normalized fields and relevant original payload. Existing record IDs remain usable references; no existing standalone evidence-detail endpoint is assumed.

Proposed run/evidence responses also expose source-layout profiles, supplied-field maps and limitations. The review UI can distinguish “not supplied by this source layout” from a supplied blank or imported annotation. A raw D2 layout cannot acquire a manual/tool status merely because the current response model has a nullable field for it.

Fictional review request shape, not an approval/export operation:

```json
{
  "target": {
    "kind": "CORRESPONDENCE",
    "id": "33333333-3333-4333-8333-333333333333"
  },
  "expected_revision": 0,
  "relationship_state": "INVESTIGATE",
  "note": "Fictional example: verify whether the two requests refer to the same investigation.",
  "supporting_evidence_ids": ["44444444-4444-4444-8444-444444444444"],
  "report_disposition": "PENDING",
  "customer_action_draft": null
}
```

Review targets may be object cases/candidates, attributions, correspondences or individual source-evidence refs, with valid operations checked per target kind. Confirming/rejecting an object candidate cannot implicitly confirm its messages or error correspondences. If prerequisite relationships are rejected, dependent suggestions must display that review conflict rather than remain presented as accepted.

| Situation | Proposed HTTP/error behavior |
|---|---|
| Unknown cycle/run/target | 404 with safe resource-not-found code |
| Missing required source role | 409 `RECONCILIATION_INPUTS_INCOMPLETE` |
| Expected IDs differ from selected cycle's source pair | 409 `RECONCILIATION_INPUTS_CHANGED` |
| Malformed/unknown write fields or unsupported rule-set version | 422 validation / `UNSUPPORTED_RULE_SET`; no arbitrary rule execution |
| Evidence/target belongs to another run or cycle | 422 `INVALID_RECONCILIATION_REFERENCE`; reject before writes |
| Stale review revision | 409 `REVIEW_REVISION_CONFLICT`; return current revision/reference for reload |
| Computation/publication failure | Safe 500 `RECONCILIATION_FAILED`; no partial results or source changes |

An imported manual label cannot call the review endpoint by itself. Record a server-side local demo actor label; it is not authenticated identity. Production permissions/authentication remain separate future requirements. Customer report approval/export endpoints are outside 0.9A–0.9D here.

## 7. Proposed Reconciliation Review screen: 0.9D

Use the existing workspace context and design tokens. Preserve Evidence Explorer as a read-only source browser. No new UI is built in 0.8.

1. **Choose context:** project/cycle and an explicit completed run; show source names/hashes, versions, limitations and empty/missing/error states. Require a new run for changed rules rather than silently refreshing old results.
2. **Browse cases:** server-paginated rows with object type/name, observed presence, object-match status, finding/message counts, attribution uncertainty and review state. Keep object comparison separate from report disposition. Search/filter scope must be explicit.
3. **Inspect side by side:** transformation findings on one side, upload-object records and technical messages on the other. Show every record's workbook, sheet, Excel row and ID; raw/normalized values remain separate. Imported annotations have their own labeled section.
4. **Review suggestions:** show “why suggested,” rule/version, exact source spans/IDs, subject versus context and missing/conflicting evidence. Show unattributed messages in a dedicated queue; do not hide them under the closest object. Multiple findings and candidate targets can be expanded without discarding alternatives.
5. **Decide explicitly:** confirm, reject or flag a particular relationship for investigation. Save a reviewer note and selected evidence; show automatic versus human-confirmed state together. Do not provide a button that approves every unrelated message on an object.
6. **Draft customer action:** record report disposition and action text against an explicit evidence scope. Preserve out-of-scope requests for customer revalidation; imported `Uploaded` does not resolve all evidence. Mark saved action text as a draft, with approval/export outside this stage.
7. **Inspect history:** show decision revisions/actor/time and rerun history. On stale save, display a reload/compare path; on cycle/run change, clear selection and abort/ignore stale requests. Never overwrite an unseen decision automatically.

Reuse the current detail dialog's raw-value visibility and provenance conventions, keyboard focus containment/restoration, visible focus, responsive tables and 320px behavior. A narrow screen can stack the two evidence panels while retaining their source labels. Confirmation controls need clear accessible names and visible saved/error states; no production-code changes are proposed now.

## 8. Implementation milestones and acceptance gates

Known-layout compatibility and pure object matching are complete. The remaining proposed order is 0.9B–0.9D, each requiring its own authorization; this document starts none of them.

| Stage | Deliverable | Independently testable done criteria | Explicit boundary |
|---|---|---|---|
| **Layout compatibility, complete** | Known aliases/pairs, header validation and absent-field handling through existing APIs | Synthetic equivalents cover provenance/nulls/ambiguity/rollback and D1 regression; all four real source files parse read-only with matching counts | No source editing, reference enrichment, new schema/entity, reconciliation or normal-DB test data |
| **0.9A, complete** | Pure object-matching domain/service and synthetic backend tests | Four outcomes, collision/provenance guards, repeated-row preservation, separate typed groups, complete row conservation, empty inputs, stable ordering/IDs and scope checks; 31 applicable matrix projections within 64 new tests | No attribution, categories, DB migrations, new API, screen, export or AI |
| **0.9B** | Pure upload-message attribution and narrowly justified error-comparison rules | Explicit links and preserved unattributed queue; body/component/block uncertainties; positive/negative lock/layer tests only when rule gates met; unresolved categories visible; no manual-label leakage | No automatic block attribution without contract confirmation; no invented mappings or customer approvals |
| **0.9C** | Snapshot loader, derived-run migrations/persistence and read/run APIs | Fresh Alembic DB, actual source FKs/scope, complete input checks, atomic publication/failure, idempotent/concurrent reruns, pagination and saved coverage/versions | No UI or review writes yet; preserve existing ingestion/evidence APIs |
| **0.9D** | Decision/event migrations, review APIs and one Reconciliation Review screen | Side-by-side evidence, explicit confirmation/rejection/investigation, saved scoped drafts, audit/concurrency/reload behavior and isolated browser acceptance | No customer XLSX export, TR integration, authentication, Radar or AI; report approval policy remains a later decision |

Before 0.9B stronger rules, resolve the corresponding questions in [RECONCILIATION_OPEN_QUESTIONS.md](RECONCILIATION_OPEN_QUESTIONS.md). Other unanswered questions must leave safe fallbacks in place rather than force speculative behavior. The original broad [implementation plan](IMPLEMENTATION_PLAN.md) remains historical roadmap context; this sequence narrows the next four reconciliation stages without changing existing files or business rules.

## 9. Validation, portability and limits

- **0.8/0.8A historical verification:** inspected documents, models, migrations, parsers, normalization, schemas, fixtures and Evidence Explorer. Rechecked both bundles' structure/counts, attribution partitions and ordinal/lexical observations through read-only parsing. The unchanged parsers established D2 compatibility failures at that stage; no engine existed then.
- **0.9A verification:** 64 new matcher tests, including 31 applicable object-level acceptance projections; 167 backend passes and one confidential-data skip. Separate hash-seed processes confirm deterministic serialization. The synthetic 15,000-row benchmark has median matching-only latency 0.8125 seconds; complexity is `O(L + n log n)` time and `O(L + n)` space for bounded-length identifiers. See [method, counts and limits](OBJECT_MATCHER.md).
- **Future test data:** implement the [matrix](MATCHING_DECISION_MATRIX.md) using synthetic source records/workbooks. Do not commit raw customer identifiers/messages or depend on the standalone Downloads demo directory. Its fictional correspondences are not ground truth.
- **Database isolation:** retain pytest `tmp_path`/explicit test settings and existing live browser ownership/token/cleanup controls. Normal API 8000/UI 5173 and `data/local/tracesync.db` must never be acceptance targets. Browser tests use 8001/5174 and disposable migrated databases; no reuse or cleanup by synthetic project-name matching.
- **Fresh Windows clone:** use declared existing dependencies, repository-relative settings, explicit Alembic migrations and no hardcoded user paths. Engine inputs are persisted records; core comparison works offline. No dependency install, service restart or migration is needed for 0.8 documentation.
- **Evaluation:** synthetic cases test software behavior. Real business accuracy needs independently reviewed object/attribution/error labels; the curated customer report and imported manual fields must not leak into predictions. Preserve uncertainty and measure coverage/review burden separately from accuracy.
- **Known limits:** layouts beyond the two explicit contracts, profile-dependent/unvalidated message context, source phase/system context, category meanings/templates, upstream message completeness, annotation provenance, action granularity and authoritative shared-TR evidence. Both bundles share objects/text and lack established human-verified correspondence labels. These constrain matching/evaluation; ingestion compatibility does not resolve them.

Historical 0.8A deliverables were documentation only. The 0.9A changes add the pure reconciliation package and synthetic tests plus contract/status documentation; pre-existing ingestion, frontend, models, routes, schemas and migrations remain unchanged by this stage. Normal database and confidential workbook hashes are unchanged. No commit or push is part of this work.

## 10. Future ML evaluation plan

This section specifies future research readiness only. No model, training/download, embedding service, external AI API or inference integration is introduced. Matching remains deterministic and reviewable; ML must not acquire authority to change scope, approval or customer actions.

### Tasks and candidate features

Keep three prediction tasks separate: object identity, message attribution and cross-phase error correspondence. A confirmed identity does not label an error pair as equivalent.

| Feature family | Available evidence / proposed future use | Limitation or leakage control |
|---|---|---|
| Object identity | Raw/normalized names/types, namespace/separator structure, missingness and normalization-risk flags; deterministic candidate retrieval | Namespaces/compound fields are not verified parent maps; repeated names across bundles cannot establish project identity |
| Error category | Explicit transformation categories with raw spelling and rule version | D2 lacks `NO_TRANS_ROUTE`; no structured upload counterpart exists; category co-occurrence is not a label |
| Technical text | Original message, phase/source kind, severity token and bounded local text features after permitted preprocessing | Fixed width differs across bundles, truncation/translation uncertain; generic templates and negation need hard negatives |
| Explicit references | Justified object/request/layer spans, comparison agreement/conflict and attribution level | A body mention can name a dependency; incomplete IDs remain unknown; no shared-cause inference across unverified target contexts |
| Source context | Verified project/cycle/target/run IDs when collected; sheet/layout, field availability, source role and provenance | Current files do not prove project/cycle independence. Sequence semantics are profile-specific; filename prefixes cannot supply verified group labels |
| Human-confirmed relationships | Future task-specific positive/negative/uncertain pair decisions, evidence scope, reviewer provenance and adjudication | These are annotation targets/provenance, not prediction inputs or automatically available gold labels; imported annotations/reference rows remain unverified aids |

Do not feed manually assigned statuses, customer-reference membership/comments or final reviewer decisions into the predictor that is evaluated against those decisions. Treat source-layout metadata primarily as a capability/coverage guard; assess whether a model is exploiting format shortcuts rather than evidence. No representation may delete original source data.

### Gold-label collection

Neither supplied bundle establishes a reliable matched/unmatched pair dataset. Collect authorized local annotations using explicit source-record pairs and task definitions. Use `MATCH`, `NO_MATCH`, and `UNCERTAIN` (or task-specific equivalent) so reviewers can abstain. Obtain independent review/adjudication for disputed or evaluation-critical cases and retain instructions, evidence refs, label version and provenance. Preserve uncertain/unlabeled examples separately; unselected report rows and algorithmic key matches are not gold negatives/positives.

Include hard negatives: same object with a different error, same category but different identifier/context, same name with different type, a dependency mention, negated/history text, compound subjects and repeated templates. Random unrelated pairs alone will overstate useful accuracy. Candidate generation and negative sampling must be documented so evaluation reflects the actual review queue.

### Grouped training, validation and test design

1. Establish verified project and cycle/source-run group IDs before splitting. Keep each source pair, all its candidate pairs, repeated rows, manual/reference artifacts and review descendants together. For new-project generalization, reserve entire projects; for later-cycle generalization, use a separately declared temporal protocol without splitting a cycle across partitions.
2. Allocate disjoint training, validation and untouched test groups before fitting text preprocessing, retrieval thresholds or models. Fit transformations on training only, tune on validation only and evaluate once on held-out test groups. Document group/sample sizes, category coverage, imbalance and unresolved labels; do not force unsupported percentage splits.
3. Audit exact/near-duplicate object/text/template families across group boundaries. The current bundles share 28 transformation typed keys, 12 upload-list typed keys, 43 distinct trimmed transformation texts and 63 distinct trimmed technical texts. Keep duplicate families together, exclude overlapping cases or report a separate overlap stratum; project/cycle grouping alone may not remove template leakage.
4. The current two bundles, with unverified project/cycle independence and no gold pairs, cannot support all three independent partitions. Acquire additional independent labeled groups first. A leave-one-bundle-out exercise would at most be exploratory and would still need leakage control and separate tuning data; it cannot substitute for a held-out test claim.
5. Compare against the versioned deterministic baseline on the same reviewed test pairs. Report task-specific precision/recall, ranking quality if applicable, abstention/coverage, unresolved cases and reviewer burden by project/cycle/category/profile. Choose any automatic-suggestion threshold only on validation groups. Performance numbers and time savings require actual measurements, not these aggregate source counts.

An eventual ML suggestion must retain source citations, model/preprocessing/rule versions and uncertainty, coexist with deterministic results and permit reviewer rejection. It must not automatically confirm parent context, label out-of-scope status, approve a report or grant access. Q-14 and the data-use questions must be answered before any such work is authorized.
