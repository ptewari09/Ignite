# Reconciliation rules specification

Version 0.1, 2026-10-27. Milestone 0.8 design proposal; no engine or rules in this document have been implemented. All new examples are fictional. Observations are evidence about these report copies, not validated SAP business rules or measured matching accuracy.

## 1. Objective and evidence boundary

Reconciliation answers three separate questions:

1. **Object identity:** which source rows have compatible object identifiers?
2. **Message attribution and error comparison:** which upload messages concern those objects, and what evidence might correspond across phases?
3. **Human decisions:** which suggested relationships and customer actions does a reviewer accept?

An exact identifier comparison answers only the first question. It cannot establish successful remediation, error equivalence, customer ownership, scope, report inclusion or access permission.

This design extends the existing ingestion models, not the generic tables proposed in the original [project reference](Project_Reference.md). The authoritative implemented contracts are [models.py](../backend/app/db/models.py), [ingestion schemas](../backend/app/schemas/ingestion.py), [importers](../backend/app/services/importers/workbook.py) and [normalization.py](../backend/app/services/normalization.py). Earlier observations are in [DATA_DICTIONARY.md](DATA_DICTIONARY.md) and [RECONCILIATION_DISCOVERY.md](RECONCILIATION_DISCOVERY.md). Confirmed business requirements remain BR-001 through BR-003 in [mapping-rules.md](mapping-rules.md).

The companion documents are the [decision matrix](MATCHING_DECISION_MATRIX.md), [open questions](RECONCILIATION_OPEN_QUESTIONS.md) and [architecture](RECONCILIATION_ARCHITECTURE.md).

## 2. What is verified today

| Existing fact | Consequence for design |
|---|---|
| `cycles.project_id` identifies the project; each cycle permits one `transformation` and one `post_upload` workbook | Match within one explicit cycle and source pair; never pool projects or cycles |
| Evidence lives in `transformation_findings`, `upload_objects` and `upload_errors` | Reference existing records; do not create a replacement source-record model |
| Each row has its own UUID, workbook ID, worksheet, Excel row, raw payload and raw/normalized identities | Repeated identities remain separate evidence records |
| Transformation has `error_category_raw`; upload objects have `tool_status_raw` and separate manual fields | Manual statuses cannot supply automatic upload categories |
| Upload `message_type_raw` is a severity/type token; `sequence_number` accepts integers or blank | Neither field is an object key, category code or global message identifier |
| Unknown labels and missing identities are preserved; empty required sheets are accepted with warnings | Missing information becomes a visible review case, not an invented value |
| Workbook role conflicts prevent replacing different source content in a cycle | A changed source pair normally belongs to a new cycle; repeated reconciliation is a separate operation |
| The database stores parsed evidence and source metadata, not the original XLSX bytes | The engine must work from persisted rows; it cannot depend on the uploaded file still existing |

A local, read-only parser inspection during 0.8 reconfirmed 361 transformation rows, 205 upload-object rows and 1,226 upload-message rows. The earlier discovery reports 172 shared normalized typed keys, 137 transformation-only names and 31 upload-only names. These are sample comparisons, not precision, recall or success metrics.

Of the 1,226 messages, 804 have a typed key found in upload objects, 33 have the same name but a different type, 224 name another subject, and 165 have no subject identity. These categories partition message rows. A named subject absent from `Objects` may be a component or related object; it is not automatically an unrelated error.

The inspection made no database connections, wrote no test data and verified unchanged source-file hashes. Only aggregate observations are recorded here; no customer object names, transport IDs or original messages are reproduced.

## 3. Proposed processing stages

| Stage | Input | Output and invariant |
|---|---|---|
| S0: capture inputs | One cycle and its two ingested workbook IDs/hashes | Immutable input manifest, engine/rule/normalization versions, warnings and row counts |
| S1: form identity groups | All transformation and upload-object rows | Groups of compatible typed keys plus individual insufficient-identity cases; every source row retained |
| S2: compare object groups | S1 groups | Exact relationships, possible relationships, ambiguous cases and one-sided cases |
| S3: attribute messages | All upload-message rows and upload-object groups | Explicit, potential or unattributed links; never overwrite message subject fields |
| S4: compare error evidence | Transformation rows and attributed messages | Versioned suggestions with evidence and reasons; unknown and unmatched rows remain visible |
| S5: publish a draft | Complete result and coverage counts | Transactional, reviewable run; no source mutations or automatic approvals |
| S6: human review | Draft plus original evidence | Separate decisions, notes and append-only audit events; automatic results remain available |

The backend must read all relevant persisted rows. Evidence Explorer's current page of 25 records and page filter are not engine input. Both workbook roles must exist before a run; headers-only datasets are allowed and explicitly distinguished from a missing workbook.

## 4. Object identity rules

### Identity and provenance keys

The proposed comparison key is `(normalized object type, normalized object name)` within the source pair. Record identity is `(source kind, record UUID)`; workbook/worksheet/Excel row and hash provide provenance. A key identifies an investigation group, not a unique finding or customer action.

Do not use category, manual status, `S.No`, source row position, the transformation `File Name` field or message severity as an object key. Do not join the reports on error text alone.

### Normalization and risk controls

The current importer returns `None` for blank values and otherwise applies `" ".join(str(value).split()).upper()`. It preserves punctuation and keeps the original values separately. The engine should use a versioned interpretation of that same function, check raw values for the following risks, and report any mismatch with stored normalized fields rather than editing them.

| Transformation | Proposed treatment |
|---|---|
| Outer whitespace, including Unicode padding; ASCII case differences | Suitable for an exact normalized comparison under this application's documented convention; show raw differences |
| Whitespace padding around object type | Suitable for comparing the same literal type token |
| Internal whitespace in a name | Preserve the normalized value but require review; collapsing spaces is not a verified SAP identity rule |
| Original numeric/boolean/non-text identifiers | Preserve importer output and original payload type; require review rather than treating string conversion as identity proof |
| Non-ASCII identifiers or Unicode uppercase collisions | Require review unless an explicit project rule validates them; do not silently equate, for example, an uppercase expansion with a distinct ASCII spelling |
| Namespace markers, underscores, suffixes and method separators | Preserve exactly; no prefix removal, parent extraction or punctuation stripping |
| Unknown object-type tokens | Preserve and flag; do not invent aliases. Initial known tokens are the observed `PROG`, `FUGR`, `CLAS`, `FUNC`, `METH`, `INCL` (the last occurs in detailed upload messages); any expansion requires a versioned rule |

These are proposed conservative engine checks, not changes to ingestion. Trimming/casing demonstrates a reproducible textual comparison, not universal SAP semantic equivalence.

### Matching precedence

- **O-01 — exact typed key:** complete, safe normalized type/name equality creates `EXACT_OBJECT_MATCH`. All rows on each side remain attached. Duplicates do not create multiple object matches or a Cartesian product.
- **O-02 — name-only candidate:** equal safe names, one or both types absent, and one viable opposite-side group create `POSSIBLE_OBJECT_MATCH`. Keep source groups distinct until reviewed; never fill a missing source type.
- **O-03 — conflict or competing targets:** incompatible types, several viable targets, or normalization risks create `AMBIGUOUS`, with explicit candidate/conflict references and reason codes. No arbitrary winner.
- **O-04 — transformation-only:** a valid transformation group with no exact or viable name candidate is `TRANSFORMATION_ONLY` relative to upload `Objects`.
- **O-05 — upload-only:** a valid upload-object group with no exact or viable name candidate is `UPLOAD_ONLY` relative to transformation findings.
- **O-06 — missing name:** create a separate `AMBIGUOUS` case for each unidentifiable source row. Two blank names never match and all blanks never become one invented object.
- **O-07 — components and fuzzy similarity:** no automatic parent/component or fuzzy matching in the initial engine. A similar name can remain unlinked. A later reviewed mapping must record its source, relationship kind and rule version.

Do not let a possible match consume or overwrite an exact match. If an exact `CLAS` pair exists while another same-name `PROG` group conflicts, preserve the exact pair and show the conflicting group separately. Repeated rows with the same complete key are multiple records behind a group; their existence alone is not competing object identity.

Display presence separately from confidence: an exact relationship means “present in both by typed key”; a possible relationship means “candidate overlap”; one-sided means “not found in the other object list”; ambiguous means “presence/identity not resolved.” Detailed messages alone do not turn an absent `Objects` entry into an uploaded object.

## 5. Upload-message attribution

| Rule | Level | Required evidence and limits |
|---|---|---|
| A-01 | `EXPLICIT` | Complete, safe message type/name key equals one canonical upload-object group; preserves every source object row behind that group |
| A-02 | `POTENTIAL` | Name agrees but type is missing/conflicting, or several groups compete; keep all candidates and explain why identity is incomplete |
| A-03 | `POTENTIAL` | The message body explicitly mentions a known name but structured subject fields cannot identify its parent; exact token boundaries and role/context review required |
| A-04 | `POTENTIAL` | A candidate investigation context is supported by the observed block structure; disabled as an automatic attachment until the export contract is confirmed |
| A-05 | `UNATTRIBUTED` | No justified target, missing identity without validated context, a broken block, or incompatible evidence without a defensible candidate |

An explicit subject link does not prove that the message states an error, or that every object mentioned inside it has that error. Informational, success, warning and blank-severity messages stay visible. If two physical upload rows share the target key, A-01 identifies their object group, not which manual note is correct.

For body references, a substring is insufficient: a mention of fictional `Z_DEMO_JOB_EXTRA` must not match `Z_DEMO_JOB`. Multiple names or statements about dependencies remain potential links. A component subject and an investigation parent are separate relationship kinds, `SUBJECT` and `CONTEXT`; confirming context must not rewrite the component as the parent.

### Block hypothesis and its limit

The existing sample has 203 blocks beginning with sequence 1; all have consecutive ordinals, a terminal named typed object with blank severity, and terminal keys that uniquely cover the upload-object groups. Every direct-key row within a block agrees with that terminal key. The other 422 messages have only this observed context or incomplete/conflicting identity.

This is a strong observation about file layout, not a verified attribution contract. Sequence number 1, blank severity, adjacency, a terminal icon or “the last named row” alone must never attach a message. The current parser also accepts sequence 0, gaps and blank values; parser acceptance does not validate block semantics.

Until question Q-02 is answered, retain candidate block ranges only as diagnostic suggestions. A future opt-in rule needs a known export profile, complete unsorted sequence, exactly one compatible terminal anchor, matching workbook/cycle, and no conflicting direct anchors. Missing terminals, reordered/concatenated logs, gaps, repeats or incomplete boundaries invalidate automatic context attribution for affected ranges. Direct subject links remain usable independently of the failed context hypothesis. Do not forward-fill identifiers.

## 6. Error correspondence is a separate rule set

There is no dedicated upload error-code/category column today. `UPLD_ERROR` is broad tool status; `E`, `W`, `I`, `S` and blank are message types. A transport identifier is contextual evidence, not an error code. Extra columns may survive in raw payloads, but no structured message-class/number contract has been established.

For future extraction, each rule must specify: ID/version, supported export profile, required attribution level, positive message predicate, negative/negated/context examples, evidence fields, identifier capture spans, limitations and enabling authority. Preserve original text. No category synonym, severity-based category, reference-derived classifier, fuzzy text equivalence or LLM is proposed for initial matching.

### Category mapping investigation

The counts below are lexical observations on directly typed upload messages for objects having the named transformation category. One object can have several transformation categories, so the same message can contribute to multiple rows. They are not verified correspondence counts, independent examples or accuracy measures.

| Transformation category | Candidate upload evidence to investigate | Evidence supporting investigation | Counterexamples and uncertainty | Confirmation needed |
|---|---|---|---|---|
| `OBJ_LOCKED` | Explicit statement of a lock on the attributable object, ideally naming the same request | Prior discovery documents a same-object request-lock example; 176 of 330 directly typed messages on objects with this category contain the whole word “locked” | Editor/dependency locks, a different request, negation, historical text, and “not modified” are not proof of the same lock | Tool owner validates exact lock templates and identifier roles; reviewer verifies cause/context |
| `NO_TLAYER` | Explicit missing/unconfigured transport-layer diagnostic with captured layer identifier | Prior discovery documents an explicit missing-layer example; 8 of 40 direct messages on such objects mention a transport layer | A layer mention alone does not state absence; layer text also occurs on objects with other transformation categories | Validate positive/negative layer templates and whether A contains a comparable identifier |
| `EDITOR_LOCK` | Explicit editor-lock diagnostic on the same subject | 54 of 210 direct messages on such objects contain “editor” | “Editor” is not a lock predicate; 52 messages on objects with `SAP_OB` also mention it, partly reflecting multiple A findings | **Unresolved:** obtain exact lock semantics, counterexamples and phase interpretation |
| `NO_DEVC` | A diagnostic explicitly establishing the intended package/development-class problem | 2 of 8 direct messages mention “package”; 2 mention a transport layer | Package and layer statements can describe different prerequisites; co-occurrence is insufficient | **Unresolved:** lead defines this category and approved comparable templates |
| `NO_TRANS_ROUTE` | A diagnostic explicitly establishing the intended route problem | 10 of 40 direct messages mention a transport layer; none match the narrow “transport route” phrase checked in this inspection | A layer failure cannot be assumed equivalent to a route failure; wording may differ or be truncated | **Unresolved:** obtain category definition and representative positive/negative route messages |
| `SAP_OB` | No reliable upload predicate established | Source category exists; 52 of 222 direct messages mention “editor”, and 2 contain “locked” | These observations overlap other categories and do not define `SAP_OB` or an equivalent upload error | **Unresolved:** authoritative meaning and comparison objective required; no automatic mapping |

Counts describe narrow case-insensitive word/phrase checks, not proposed production regexes. First consider lock and layer suggestions because they have concrete supporting examples. Their exact pattern definitions and negative tests still require validation. No mapping is approved or enabled by Milestone 0.8.

### Proposed comparison outcomes

These refine the original reference's provisional labels. They describe individual evidence comparisons or unmatched evidence, not the object match or business disposition.

| Outcome | Meaning and gate |
|---|---|
| `STRONG_CORRESPONDENCE` | Validated rule, reliable subject attribution, compatible target/phase context and matching discriminating identifiers where applicable, with no contradictory evidence; still an automatic suggestion, not human confirmation |
| `POSSIBLE_CORRESPONDENCE` | Some positive rule evidence, but a category, identifier, attribution or context remains uncertain; disclose every dependency |
| `DIFFERENT_ERROR_EVIDENCE` | Same object has supported evidence of different error themes/identifiers; describes that evidence pair, not automation failure or replacement of every earlier finding |
| `NO_CORRESPONDENCE_IDENTIFIED` | No pair was identified under the recorded rules and inspected scope; does not mean an error was fixed or never occurred |
| `UPLOAD_ONLY_ERROR` | A comparable upload diagnostic is attributable to an upload-only object with no transformation candidate; not proof of a newly introduced defect |
| `INSUFFICIENT_EVIDENCE` | Missing identity, unsupported category, unavailable context, unknown patterns or unresolved competing interpretations prevent comparison |

Strong suggestions must be unavailable when their prerequisites are unresolved. Shared category alone can at most support a possible relationship; different known request/layer identifiers should expose a difference rather than a strong correspondence. Missing identifiers must not be filled from neighboring rows or manual comments. The currently absent system/client/phase metadata limits claims even when identifier text agrees.

Preserve one-to-many and many-to-many evidence relationships. For A categories `{lock, layer}` and upload layer evidence, show the supported layer comparison and the unpaired lock finding separately. Do not collapse the object to “same error” or select only its first message. Multiplicity is a count/flag, not a replacement comparison outcome. Unclassified upload messages remain searchable evidence and count toward incomplete comparison coverage.

## 7. Manual fields and customer decisions

- Preserve `manual_status_raw`, `manual_comments_raw`, source suggested actions and tool status independently. They must not be inputs to automatic category or identity predictions.
- `Uploaded` is an imported reviewer label, not proof that all messages are resolved or that the tool's `UPLD_ERROR` should be replaced. Its timestamp, author and verification are unknown.
- Preserve `Out of scope` with its provenance wherever supplied. Under BR-002 it means absence from the applicable shared TR and current team visibility/access in this workflow. Report overlap, technical categories and a missing TR inventory cannot establish that absence.
- BR-001 requires reviewed out-of-scope entries in the customer reporting workflow for revalidation/access decisions before the second run. BR-003 records the usual response of adding an object to that TR or supplying another. Do not auto-exclude, invent access permission or assume a second run can proceed.
- A reviewer may explicitly adopt an imported annotation as a new decision with a note and audit event. Importing it is not adopting it.
- Keep relationship review (`PENDING`, `CONFIRMED`, `REJECTED`, `INVESTIGATE`), report disposition (`PENDING`, `INCLUDE`, `EXCLUDE`, `RECHECK`) and eventual report approval (`DRAFT`, `APPROVED`) distinct. These are proposed review contracts; scope/access evidence is another separate concern.
- Initial review proposals may record customer-action drafts, selected supporting evidence and notes. Report approval/export and authoritative access tracking require their own later scope and confirmed business policy.

## 8. Completeness, determinism and release gates

For each run, record source-record totals, exact/possible/ambiguous/one-sided cases, attributed/unattributed message totals, comparison coverage and unresolved reasons. Every source row must be reachable from the run, including unnamed records and informational messages. Count unique source records separately from relationship edges and object groups; several candidate links must not inflate row totals.

Stable sorting uses normalized type/name, source role/kind, worksheet, Excel row and record UUID as tie-breakers. The same source manifest and versions must yield the same semantic result, reasons and evidence ordering; new storage UUIDs/timestamps are not algorithm output. No percentage “confidence” is proposed without calibration. No precision/recall or time-saving claims can be made without verified labels and comparable measurements.

Run decisions remain separate from algorithm output. Reusing an identical completed run preserves decisions; new inputs or versions create a new run with pending decisions, while old decisions remain accessible. No automatic carry-forward or silent overwrite. A rejection stays rejected on the same run until explicitly revised.

Before enabling a new rule, add positive, negative, duplicate, missing-identity and conflict scenarios from the [matrix](MATCHING_DECISION_MATRIX.md); document the enabling answer in the rule register. Missing answers block the affected automatic rule, not conservative object discovery.

The next recommended stage is **0.9A: a pure deterministic object-matching engine and synthetic backend tests only**. No database migration, endpoint, screen, message-block inference, category extraction, report output or AI is authorized by this document. Implementation stages and proposed contracts are in the [architecture](RECONCILIATION_ARCHITECTURE.md).
