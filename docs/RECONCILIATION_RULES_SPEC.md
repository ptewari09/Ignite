# Reconciliation rules specification

Version 0.4, 2026-10-28. The pure object-level matcher is implemented in 0.9A; its authoritative contract is [OBJECT_MATCHER.md](OBJECT_MATCHER.md). Message attribution, error comparison, persistence, APIs and review remain proposals. Source-layout compatibility is implemented by 0.8C. All new examples are fictional. Observations concern two report bundles, not validated SAP business rules or measured matching accuracy.

## 1. Objective and evidence boundary

Reconciliation answers three separate questions:

1. **Object identity:** which source rows have compatible object identifiers?
2. **Message attribution and error comparison:** which upload messages concern those objects, and what evidence might correspond across phases?
3. **Human decisions:** which suggested relationships and customer actions does a reviewer accept?

An exact identifier comparison answers only the first question. It cannot establish successful remediation, error equivalence, customer ownership, scope, report inclusion or access permission.

This design extends the existing ingestion models, not the generic tables proposed in the original [project reference](Project_Reference.md). The authoritative implemented contracts are [models.py](../backend/app/db/models.py), [ingestion schemas](../backend/app/schemas/ingestion.py), [importers](../backend/app/services/importers/workbook.py) and [normalization.py](../backend/app/services/normalization.py). Earlier observations are in [DATA_DICTIONARY.md](DATA_DICTIONARY.md) and [RECONCILIATION_DISCOVERY.md](RECONCILIATION_DISCOVERY.md). Confirmed business requirements remain BR-001 through BR-003 in [mapping-rules.md](mapping-rules.md).

The companion documents are the [decision matrix](MATCHING_DECISION_MATRIX.md), [open questions](RECONCILIATION_OPEN_QUESTIONS.md), [architecture](RECONCILIATION_ARCHITECTURE.md) and [cross-dataset findings](CROSS_DATASET_FINDINGS.md). The findings classify each identity/attribution rule and the normalization, comparison and governance proposals by observed support or uncertainty.

## 2. What is verified today

| Existing fact | Consequence for design |
|---|---|
| `cycles.project_id` identifies the project; each cycle permits one `transformation` and one `post_upload` workbook | Match within one explicit cycle and source pair; never pool projects or cycles |
| Evidence lives in `transformation_findings`, `upload_objects` and `upload_errors` | Reference existing records; do not create a replacement source-record model |
| Each row has its own UUID, workbook ID, worksheet, Excel row, raw payload and raw/normalized identities | Repeated identities remain separate evidence records |
| Transformation has `error_category_raw`; upload objects have `tool_status_raw` and separate manual fields | Manual statuses cannot supply automatic upload categories |
| Nullable model fields do not prove a column existed in a source layout | Distinguish an absent field from a supplied blank; never invent a tool/manual status |
| Upload `message_type_raw` is a severity/type token; `sequence_number` accepts integers or blank | Neither field is an object key, category code or global message identifier |
| Unknown labels and missing identities are preserved; empty required sheets are accepted with warnings | Missing information becomes a visible review case, not an invented value |
| Workbook role conflicts prevent replacing different source content in a cycle | A changed source pair normally belongs to a new cycle; repeated reconciliation is a separate operation |
| The database stores parsed evidence and source metadata, not the original XLSX bytes | The engine must work from persisted rows; it cannot depend on the uploaded file still existing |

A local, read-only inspection reconfirmed Dataset 1 (D1): 361 transformation rows, 205 upload-object rows and 1,226 messages; 172 shared normalized typed keys, 137 transformation-only names and 31 upload-only names. Dataset 2 (D2) has 421 transformation rows, 163 object rows and 865 messages; 134 shared typed keys, 251 transformation-only names (252 typed keys) and 14 upload-only names. D2 has one transformation name with two types, both absent from its upload list. These are structural comparisons, not engine output, precision, recall or success metrics.

For D1, message attribution partitions are 804 direct typed keys / 33 same-name incompatible types / 224 other named subjects / 165 unnamed subjects. D2 partitions are 526 / 5 / 288 / 46. A named subject absent from the upload-object list may be a component or related object; it is not automatically an unrelated error. Distinct names and typed keys must be counted separately.

The 0.8A inspection found D2 tab-name and four-column incompatibilities. The 0.8C implementation now accepts `Detailed_LOG`/`Detailed_Log` and either complete post-upload pair. The named layout remains strict; the raw layout permits the four absent status/annotation columns. All four real source files parse read-only with the counts above. Historical gaps remain in [CROSS_DATASET_FINDINGS.md](CROSS_DATASET_FINDINGS.md); the current contract is [INGESTION_LAYOUTS.md](INGESTION_LAYOUTS.md).

**L-01, implemented for the known layouts:** require one supported worksheet layout and validate its required headers; never guess sheet roles from filenames. Both complete post-upload pairs are rejected as ambiguous. **L-02, implemented through existing provenance:** preserve actual sheets/raw payloads; absent raw-layout fields remain null with absent payload keys and a column-count warning, while supplied blanks retain keys. No reference labels are copied. Persisted versioned reconciliation profiles remain future design; no schema or API field was added for compatibility.

The inspections made no database connections, wrote no test data and verified unchanged hashes for all six workbooks. Only aggregate observations are recorded here; no customer object names, transport IDs or original messages are reproduced.

## 3. Proposed processing stages

| Stage | Input | Output and invariant |
|---|---|---|
| S0: capture inputs | One cycle and its two ingested workbook IDs/hashes | Immutable input manifest, source-layout profiles/field availability, engine/rule/normalization versions, warnings and row counts |
| S1: form identity groups | All transformation and upload-object rows | Groups of compatible typed keys plus individual insufficient-identity cases; every source row retained |
| S2: compare object groups | S1 groups | Implemented pure outcomes: `SHARED`, `TRANSFORMATION_ONLY`, `UPLOAD_ONLY`, `NEEDS_REVIEW`; no name-only candidate links |
| S3: attribute messages | All upload-message rows and upload-object groups | Explicit, potential or unattributed links; never overwrite message subject fields |
| S4: compare error evidence | Transformation rows and attributed messages | Versioned suggestions with evidence and reasons; unknown and unmatched rows remain visible |
| S5: publish a draft | Complete result and coverage counts | Transactional, reviewable run; no source mutations or automatic approvals |
| S6: human review | Draft plus original evidence | Separate decisions, notes and append-only audit events; automatic results remain available |

The backend must read all relevant persisted rows. Evidence Explorer's current page of 25 records and page filter are not engine input. Both workbook roles must exist before a run; headers-only datasets are allowed and explicitly distinguished from a missing workbook.

## 4. Object identity rules

### Identity and provenance keys

The implemented comparison key is `(normalized object type, normalized object name)` within the source pair. Record identity is `(source kind, record UUID)` where available; workbook/worksheet/Excel row provide additional provenance. Source hashes belong to the future run manifest. The pure matcher accepts frozen identity snapshots, validates supplied scope and never queries the database. A key identifies an investigation group, not a unique finding or customer action.

Do not use category, manual status, `S.No`, source row position, the transformation `File Name` field or message severity as an object key. Do not join the reports on error text alone.

### Normalization and risk controls

The current importer returns `None` for blank values and otherwise applies `" ".join(str(value).split()).upper()`. It preserves punctuation and keeps the original values separately. The engine reuses this function, checks raw values for the following risks, and reports mismatches with stored normalized fields rather than editing them. Its policy version is `object-match-v1`.

| Transformation | Implemented treatment |
|---|---|
| Outer whitespace, including Unicode padding; ASCII case differences | Suitable for an exact normalized comparison under this application's documented convention; show raw differences |
| Whitespace padding around object type | Suitable for comparing the same literal type token |
| Internal whitespace in a name | Preserve the normalized value and require format/identity review; 113 D1 and 160 D2 transformation fields contain internal spaces. Do not declare them corrupt or delete their possible component structure; collapsing spaces is not a verified semantic identity rule |
| Original numeric/boolean/non-text identifiers | Preserve importer output and original payload type; require review rather than treating string conversion as identity proof |
| Non-ASCII identifiers or Unicode uppercase collisions | Require review unless an explicit project rule validates them; do not silently equate, for example, an uppercase expansion with a distinct ASCII spelling |
| Namespace markers, underscores, suffixes and method separators | Preserve exactly; no prefix removal, parent extraction or punctuation stripping |
| Unknown object-type tokens | Preserve and flag; do not invent aliases. Initial known tokens are the observed `PROG`, `FUGR`, `CLAS`, `FUNC`, `METH`, `INCL` (the last occurs in detailed upload messages); any expansion requires a versioned rule |

These are implemented conservative engine checks with no ingestion change. Trimming/casing demonstrates a reproducible textual comparison, not universal SAP semantic equivalence. Collisions are detected by comparing raw scalar-type/spelling signatures behind each supplied normalized pair, ignoring only outer whitespace and ASCII case. Different signatures quarantine every affected row, including otherwise safe counterparts. Unknown or missing provenance also requires review; see the complete [flags and collision contract](OBJECT_MATCHER.md).

### Matching precedence

- **O-01 — exact typed key:** complete, safe normalized type/name equality creates `SHARED`. All rows on each side remain attached. Duplicates do not create multiple object matches or a Cartesian product.
- **O-02 — missing type:** each incomplete row is `NEEDS_REVIEW`, with no name-only link or inferred type. This supersedes the earlier name-only candidate proposal. An opposite eligible same-name key also requires review when the missing type prevents an absence conclusion.
- **O-03 — conflict or competing targets:** cross-source same-name incompatible types, competing identities or normalization risks create `NEEDS_REVIEW` with explicit flags. Unsafe source rows stay separate; no candidate edges or arbitrary winner are produced.
- **O-04 — transformation-only:** an eligible transformation key with no exact counterpart, opposite same-name conflict or potentially corresponding incomplete identity is `TRANSFORMATION_ONLY` relative to upload objects.
- **O-05 — upload-only:** the corresponding eligible upload key is `UPLOAD_ONLY` relative to transformation findings.
- **O-06 — missing name:** create a separate `NEEDS_REVIEW` case for each unidentifiable source row. Two blank names never match and all blanks never become one invented object. An unnamed row with a known trustworthy type limits opposite one-sided claims for that type; wholly unknown identity limits all such claims. Neither creates a relationship.
- **O-07 — components and fuzzy similarity:** no automatic parent/component or fuzzy matching in the initial engine. A similar name can remain unlinked. A later reviewed mapping must record its source, relationship kind and rule version.

Do not let a possible match consume or overwrite an exact match. If an exact `CLAS` pair exists while another same-name `PROG` group conflicts, preserve the exact pair and show the conflicting group separately. If two complete same-name/different-type groups are both absent from the opposite report, preserve two one-sided groups; the name alone does not merge them or require an invented opposite-side candidate. Repeated rows with the same complete key are multiple records behind a group; their existence alone is not competing object identity. D2 has up to 15 upload rows behind one key, including physically identical rows; all remain source evidence.

`SHARED` means present in both by a checked typed key; one-sided means the key was absent from the other object collection without conflicting/incomplete evidence; `NEEDS_REVIEW` means identity/comparison is inconclusive. These are object outcomes, not error comparison or reviewer dispositions. Detailed messages alone do not turn an absent object-list entry into an uploaded object. Summaries distinguish case counts, contributing source rows, observed names/pairs, eligible grouped keys and rows requiring review.

## 5. Upload-message attribution

| Rule | Level | Required evidence and limits |
|---|---|---|
| A-01 | `EXPLICIT` | Complete, safe structured object type/name key equals one canonical upload-object group; preserves every source object row behind that group; severity `Type` is not this object type |
| A-02 | `POTENTIAL` | Name agrees but type is missing/conflicting, or several groups compete; keep all candidates and explain why identity is incomplete |
| A-03 | `POTENTIAL` | The message body explicitly mentions a known name but structured subject fields cannot identify its parent; exact token boundaries and role/context review required |
| A-04 | `POTENTIAL` | A candidate investigation context is supported by a known layout's observed structure; D1 reset-based context does not apply to D2. Automatic attachment remains disabled until the relevant export contract is confirmed |
| A-05 | `UNATTRIBUTED` | No justified target, missing identity without validated context, a broken block, or incompatible evidence without a defensible candidate |

An explicit subject link does not prove that the message states an error, or that every object mentioned inside it has that error. Informational, success, warning and blank-severity messages stay visible. If two physical upload rows share the target key, A-01 identifies their object group, not which manual note is correct.

For body references, a substring is insufficient: a mention of fictional `Z_DEMO_JOB_EXTRA` must not match `Z_DEMO_JOB`. Multiple names or statements about dependencies remain potential links. A component subject and an investigation parent are separate relationship kinds, `SUBJECT` and `CONTEXT`; confirming context must not rewrite the component as the parent.

### Block hypothesis and its limit

D1 has 203 blocks beginning with sequence 1; all have consecutive ordinals, a terminal named typed object with blank severity, and terminal keys that uniquely cover the upload-object groups. Every direct-key row within a block agrees with that terminal key. Its other 422 messages have only observed context or incomplete/conflicting identity.

D2 contradicts generalizing this layout: all 865 sequence values are distinct and strictly increasing over 1–1,164, with gaps and only one 1. A single reset-based range would conflict with 523 direct-key rows. A separate blank-severity scan finds 170 terminal candidates, only 147 of which name listed keys; 23 name unlisted keys and one listed key has no terminal. Neither scan is a validated D2 parent rule. Do not infer why ordinals are absent or reconstruct missing rows.

This is a strong observation about file layout, not a verified attribution contract. Sequence number 1, blank severity, adjacency, a terminal icon or “the last named row” alone must never attach a message. The current parser also accepts sequence 0, gaps and blank values; parser acceptance does not validate block semantics.

Until question Q-02 is answered, retain candidate block ranges only as diagnostic suggestions. A future opt-in rule needs a known export profile, that profile's confirmed boundary/ordinal contract, exactly one compatible terminal anchor, matching workbook/cycle, and no conflicting direct anchors. Consecutive reset ordinals are a D1 hypothesis, not a universal prerequisite or a D2 algorithm. Missing terminals, reordered/concatenated logs, gaps, repeats or incomplete boundaries must be evaluated against the approved profile and otherwise disable context attribution. Direct subject links remain usable independently. Do not forward-fill identifiers or create upload objects from unlisted terminal subjects.

## 6. Error correspondence is a separate rule set

Neither bundle has a dedicated structured upload error-code/category column. D1 supplies broad tool status `UPLD_ERROR`; D2 does not supply that field. `E`, `W`, `I`, `S` and blank are message types in both. A transport identifier is contextual evidence, not an error code. Extra columns may survive in raw payloads, but no structured message-class/number contract has been established.

For future extraction, each rule must specify: ID/version, supported export profile, required attribution level, positive message predicate, negative/negated/context examples, evidence fields, identifier capture spans, limitations and enabling authority. Preserve original text. No category synonym, severity-based category, reference-derived classifier, fuzzy text equivalence or LLM is proposed for initial matching.

### Category mapping investigation

The counts below are lexical observations on directly typed upload messages for objects having the named transformation category. One object can have several transformation categories, so the same message can contribute to multiple rows. They are not verified correspondence counts, independent examples or accuracy measures. D2 contains five of D1's six categories, with no `NO_TRANS_ROUTE` finding.

| Transformation category | Candidate upload evidence to investigate | Evidence supporting investigation | Counterexamples and uncertainty | Confirmation needed |
|---|---|---|---|---|
| `OBJ_LOCKED` | Explicit statement of a lock on the attributable object, ideally naming the same request | D1: 176/330 direct messages contain “locked”; D2: 221/374. Prior D1 discovery documents a request-lock example | Editor/dependency locks, a different request, negation, historical text, and “not modified” are not proof of the same lock | Tool owner validates exact lock templates and identifier roles; reviewer verifies cause/context |
| `NO_TLAYER` | Explicit missing/unconfigured transport-layer diagnostic with captured layer identifier | D1: 8/40 direct messages mention a layer; D2: 2/36. Prior D1 discovery documents an explicit missing-layer example | D2 messages on these objects also include package/lock wording; mention or category co-occurrence is not equivalence | Validate positive/negative layer templates and whether A contains a comparable identifier |
| `EDITOR_LOCK` | Explicit editor-lock diagnostic on the same subject | D1: 54/210 direct messages contain “editor”; D2: 28/49 | `SAP_OB` objects also have editor wording: 52/222 in D1 and 28/69 in D2; keyword equality is insufficient | **Unresolved:** obtain exact lock semantics, counterexamples and phase interpretation |
| `NO_DEVC` | A diagnostic explicitly establishing the intended package/development-class problem | Package wording occurs in 2/8 direct messages in D1, 3/10 in D2 | Repeated transformation pairs are `NO_DEVC`/`NO_TRANS_ROUTE` in D1 but `NO_DEVC`/`NO_TLAYER` in D2; no fixed pairing or alias follows | **Unresolved:** lead defines this category and approved comparable templates |
| `NO_TRANS_ROUTE` | A diagnostic explicitly establishing the intended route problem | D1: 10/40 direct messages mention a layer and none match the narrow “transport route” phrase checked; D2 has no such transformation category | No cross-dataset validation; a layer failure cannot be assumed equivalent to a route failure | **Unresolved:** obtain category definition and representative positive/negative route messages |
| `SAP_OB` | No reliable upload predicate established | Editor wording occurs in D1 52/222 and D2 28/69 direct messages; lock wording also occurs | Multiple A categories explain overlapping observations; D2 adds `SAP_OB`/`OBJ_LOCKED` pairs, not an equivalence rule | **Unresolved:** authoritative meaning and comparison objective required; no automatic mapping |

Counts describe narrow case-insensitive word/phrase checks, not proposed production regexes. First consider lock and layer suggestions because both bundles provide lexical leads. Exact predicates, identifiers, negative tests and semantic truth still require validation. Neither 0.8 nor 0.8A approves or enables a SAP mapping.

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
- These source annotation/status columns exist in D1's upload report but are absent from D2's raw object list. Preserve field availability; do not populate them from D2's reference output or treat absence as a negative label.
- `Uploaded` is an imported reviewer label, not proof that all messages are resolved or that the tool's `UPLD_ERROR` should be replaced. Its timestamp, author and verification are unknown.
- Preserve `Out of scope` with its provenance wherever supplied. Under BR-002 it means absence from the applicable shared TR and current team visibility/access in this workflow. Report overlap, technical categories and a missing TR inventory cannot establish that absence.
- BR-001 requires reviewed out-of-scope entries in the customer reporting workflow for revalidation/access decisions before the second run. BR-003 records the usual response of adding an object to that TR or supplying another. Do not auto-exclude, invent access permission or assume a second run can proceed.
- A reviewer may explicitly adopt an imported annotation as a new decision with a note and audit event. Importing it is not adopting it.
- Keep relationship review (`PENDING`, `CONFIRMED`, `REJECTED`, `INVESTIGATE`), report disposition (`PENDING`, `INCLUDE`, `EXCLUDE`, `RECHECK`) and eventual report approval (`DRAFT`, `APPROVED`) distinct. These are proposed review contracts; scope/access evidence is another separate concern.
- Initial review proposals may record customer-action drafts, selected supporting evidence and notes. Report approval/export and authoritative access tracking require their own later scope and confirmed business policy.

D2's reference has no out-of-scope entries or recheck tab. That does not revoke BR-001–BR-003, prove shared-TR membership, or establish that no rechecks are needed. No human-verified matched/unmatched object/error-pair set has been supplied by either bundle; manual/reference labels are not automatic ML ground truth.

## 8. Completeness, determinism and release gates

For each run, record source-record totals, exact/possible/ambiguous/one-sided cases, attributed/unattributed message totals, comparison coverage and unresolved reasons. Every source row must be reachable from the run, including unnamed records and informational messages. Count unique source records separately from relationship edges and object groups; several candidate links must not inflate row totals.

Stable sorting uses normalized type/name, source role/kind, worksheet, Excel row and record UUID as tie-breakers. The same source manifest and versions must yield the same semantic result, reasons and evidence ordering; new storage UUIDs/timestamps are not algorithm output. No percentage “confidence” is proposed without calibration. No precision/recall or time-saving claims can be made without verified labels and comparable measurements.

Run decisions remain separate from algorithm output. Reusing an identical completed run preserves decisions; new inputs or versions create a new run with pending decisions, while old decisions remain accessible. No automatic carry-forward or silent overwrite. A rejection stays rejected on the same run until explicitly revised.

Before enabling a new rule, add positive, negative, duplicate, missing-identity and conflict scenarios from the [matrix](MATCHING_DECISION_MATRIX.md); document the enabling answer in the rule register. Missing answers block the affected automatic rule, not conservative object discovery.

Layout compatibility under L-01/L-02 and **0.9A pure object matching are complete**. The matcher has 64 synthetic tests, including 31 applicable object-level acceptance projections; the complete backend suite has 167 passes and one confidential-data skip. Message links, category mappings, persistence, review, ML and reporting remain unimplemented. Remaining stages and future ML evaluation are in the [architecture](RECONCILIATION_ARCHITECTURE.md); measured matching-only performance and limitations are in [OBJECT_MATCHER.md](OBJECT_MATCHER.md).
