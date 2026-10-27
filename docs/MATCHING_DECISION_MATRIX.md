# Matching decision matrix

Version 0.1, 2026-10-27. Proposed synthetic acceptance scenarios for Milestones 0.9A through 0.9D. **These are test specifications, not implemented or executed tests.** The [rules specification](RECONCILIATION_RULES_SPEC.md) defines the labels and gates; the [architecture](RECONCILIATION_ARCHITECTURE.md) defines the implementation sequence.

Every object, message, request and layer below is fictional. Error words express test intent; they do not establish SAP message semantics. A comparison test requiring a validated pattern must use a clearly named, test-only rule or a future approved rule, not claim that a synthetic sentence validates a production mapping.

## Notation and common assertions

- `A2` means transformation `Detailed_LOG`, Excel row 2.
- `O2` means post-upload `Objects`, Excel row 2; `E2` means its `Errors` row 2. Both belong to the same post-upload workbook.
- Every input has an independent source-record ID and workbook ID. The same row number in different sheets/files is not the same record.
- `T`, `U`, `M` count transformation rows, upload-object rows and technical messages respectively. These source counts must be conserved independently of the number of relationships.
- Unless stated otherwise, identifiers are complete, safe and use the same project/cycle. All decisions initially remain `PENDING`; no customer action is approved by matching.

For each future test assert the outcome **and** its reason, evidence references, unchanged raw payload, source kind/workbook/sheet/row, normalized values and source coverage. A zero candidate count must never hide the source row. Exact matches are technical key equality, not human-confirmed SAP equivalence.

## 1. Object identity: 0.9A

| ID | Synthetic input | Expected result | Preservation / negative assertion |
|---|---|---|---|
| O01 | A2 `PROG / Z_DEMO_JOB`; O2 same key | One `EXACT_OBJECT_MATCH`, 1 T and 1 U | Both source rows remain; errors are not compared in 0.9A |
| O02 | A2 type ` prog  `, name ` z_demo_job `; O2 uppercase trimmed values | Exact normalized match with normalization reason | Display both raw spellings; do not rewrite A2 |
| O03 | A2 name surrounded by Unicode nonbreaking-space padding; O2 same trimmed name | Exact normalized match | Outer whitespace normalization is visible and reproducible |
| O04 | A2 `Z_DEMO  JOB`; O2 `Z_DEMO JOB` | `AMBIGUOUS`, internal-whitespace risk | Collapsed textual equality is not accepted automatically |
| O05 | A2 non-ASCII `Z_DEMO_ß`; O2 `Z_DEMO_SS` | `AMBIGUOUS`, Unicode uppercase collision risk | No automatic equivalence based on `upper()` expansion |
| O06 | A2 original object-name cell is numeric `123`; O2 text `123` | `AMBIGUOUS`, non-text source identity | Preserve original payload types even though importer text values agree |
| O07 | A2 `CLAS / /DEMO/CL_RULE=>CHECK`; O2 identical key | Exact match of that literal typed name | Do not strip namespace or method separator |
| O08 | A2 `CLAS / ZCL_DEMO_RULE`; O2 `METH / ZCL_DEMO_RULE=>CHECK` | Separate `TRANSFORMATION_ONLY` and `UPLOAD_ONLY` groups | No inferred parent relationship from a prefix; later context requires a documented rule |
| O09 | A2 type blank, name `Z_DEMO_JOB`; O2 `PROG / Z_DEMO_JOB` | Distinct source groups with `POSSIBLE_OBJECT_MATCH` candidate | Missing type remains blank; possible overlap does not become exact |
| O10 | Both types blank, same safe name, one group per side | Possible relationship requiring review | No invented canonical type |
| O11 | A2 `PROG / Z_DEMO_JOB`; O2 `CLAS / Z_DEMO_JOB` | `AMBIGUOUS`, incompatible types | No automatic alias or name-only confirmation |
| O12 | A2 blank type/name `Z_DEMO_NODE`; O2 `CLAS` and O3 `PROG` with that name | All competing relationships remain ambiguous | No first-row winner; do not merge the two typed upload groups |
| O13 | A2 and O2 exact `CLAS / Z_DEMO_NODE`; O3 same name with `PROG` | Keep exact pair; separate ambiguous conflicting group | A conflict cannot consume the exact pair or attach O3 to it as fact |
| O14 | A2/A3 same typed key, categories `OBJ_LOCKED` and `NO_TLAYER`; O2 same key | One exact object group, 2 T and 1 U | Both findings and categories preserved; not two matched objects |
| O15 | A2/A3 physically duplicate findings; O2 same key | One exact object group, both T rows retained | Do not deduplicate source rows by text |
| O16 | A2 same key as O2/O3, whose manual comments differ | One exact group, 1 T and 2 U | Keep both manual annotations; identity cannot select the “correct” comment |
| O17 | A2 valid key absent from upload `Objects` | `TRANSFORMATION_ONLY` | No claim that a change was missed or the object is out of scope |
| O18 | O2 valid key absent from A | `UPLOAD_ONLY` | No claim of a new automation defect |
| O19 | A2 name blank; O2 name blank | Two separate insufficient-identity `AMBIGUOUS` cases | Blank values never match; do not group all unnamed rows together |
| O20 | A2 known name, unknown type token `DEMO_TYPE`; O2 same text | Review required for unrecognized type | Raw token accepted as source text; no invented type alias |
| O21 | A2 `Z_DEMO_JOB`; O2 `Z_DEMO_JOB_EXTRA` | Separate one-sided groups | No substring/fuzzy automatic match |
| O22 | Same typed name exists in two projects or cycles | Each run sees only its selected cycle | No cross-project or cross-cycle relationships |

## 2. Upload-message attribution: 0.9B

| ID | Synthetic input | Expected attribution | Preservation / negative assertion |
|---|---|---|---|
| A01 | O2 typed key equals E2 structured subject | `EXPLICIT`, relationship kind `SUBJECT` | Technical message retained even if informational or blank severity |
| A02 | O2/O3 share a key; E2 refers to it | Explicit link to their object group | One message, both source object records; no message duplication and no choice of manual note |
| A03 | E2 has matching name but no type, one viable O group | `POTENTIAL` | Do not fill E2's missing type |
| A04 | E2 name matches O2 but types conflict | Potential conflict case if a name candidate exists | No confirmed same-object or parent relationship |
| A05 | E2 names a subject absent from `Objects` | `UNATTRIBUTED` unless another defensible potential context exists | Preserve its own identity; absence is not proof it is irrelevant |
| A06 | E2 has no identity and sits after a named row | Unattributed | Adjacency cannot supply identity |
| A07 | E2 has no identity but mentions exact known name `Z_DEMO_JOB` in text | Potential body-reference link | A mention can be a dependency; never direct subject attribution from text alone |
| A08 | E2 mentions `Z_DEMO_JOB_EXTRA`; only `Z_DEMO_JOB` exists | No body-reference candidate for the shorter name | Token boundaries prevent substring matching |
| A09 | E2 mentions two known objects or has a structured subject conflicting with body context | Preserve subject link where valid; flag comparison/context ambiguity | Do not silently move the message to the other mentioned object |
| A10 | Fictional sequences 1, 2, 3; final row names O2 with blank severity | At most potential block context while export contract is unconfirmed | An attractive layout is not a verified block contract |
| A11 | A future approved export profile satisfies every block predicate | Retain explicit subject links; permit only that profile's validated context links | Subject and parent context remain distinct; approval of context does not change source identity |
| A12 | Sorted rows, sequence gap, repeated 1 inside a range, missing terminal or conflicting direct anchor | Reject automatic block context for affected ranges | Preserve unaffected explicit links and all unassigned messages |
| A13 | `S.No` values 0 or blank, which ingestion supports | Retain records; context needs review | No assumption that every accepted sequence forms a block |
| A14 | Same typed subject appears in several blocks | Retain all source messages and separate observed ranges | No assumption of one block per object in all exports |

## 3. Error comparison: 0.9B

| ID | Synthetic input | Expected comparison | Required guard |
|---|---|---|---|
| E01 | Exact object; A and explicitly attributable E have a validated lock predicate and same explicit fictional request `TD1K900101`; target context confirmed | Eligible for `STRONG_CORRESPONDENCE` suggestion | Requires the future rule and every strong-evidence gate; still not reviewer confirmation |
| E02 | Same lock theme but A lacks request identifier or context confirmation | Possible correspondence at most | Never copy a request identifier into A from E |
| E03 | A and E indicate locks but name different fictional requests | `DIFFERENT_ERROR_EVIDENCE` or unresolved historical context | Category equality alone is insufficient; expose both IDs |
| E04 | Exact object; validated A lock evidence versus upload layer diagnostic | Different error evidence, with explanation of rule coverage | Do not call it an automation defect or say the old lock is resolved |
| E05 | A2/A3 categories lock and layer; E2 supports layer | Separate layer candidate plus unpaired lock evidence | Multiplicity is retained; no single “same error” summary |
| E06 | One A finding and three explicit E messages, two repeated word-for-word | Preserve all three E record IDs | No evidence deduplication; no multiplication of matched-object totals |
| E07 | A category `NO_TRANS_ROUTE`; E mentions a layer | Insufficient evidence unless a future rule explicitly supports that relationship | Route-to-layer equivalence is unresolved |
| E08 | A `SAP_OB` and `EDITOR_LOCK`; E mentions editor activity | No automatic mapping of the message to both findings | Co-occurrence and a generic word cannot establish equivalence |
| E09 | E says fictional “Object is not locked”; A has `OBJ_LOCKED` | No positive lock suggestion from the word “locked” alone | Future pattern must handle negation and quoted/history context |
| E10 | E says “not modified” or contains only an informational summary | Preserve as evidence; insufficient by itself for a lock category | Severity, presence in `Errors`, or a summary icon does not supply an error category |
| E11 | A has unknown category `DEMO_UNKNOWN`; E repeats identical text | Expose literal text equality and unresolved category | No invented synonym or automatic strong semantic correspondence |
| E12 | Exact object but no comparable upload diagnostic is identified after covered rules run | `NO_CORRESPONDENCE_IDENTIFIED` with coverage/rule versions | Do not infer fixed, successful, or absence of any possible error |
| E13 | O2 is upload-only and E2 is a supported explicit diagnostic for it | `UPLOAD_ONLY_ERROR` | If identity is only potential, keep insufficient/ambiguous status instead |
| E14 | Unnamed/unattributed E alongside a transformation-only key | No automatic cross-report correspondence | A keyword or neighboring row cannot create a missing object relationship |
| E15 | Message truncates before a complete request/layer token | Possible or insufficient evidence | No fabricated identifier; partial prefixes do not establish shared cause |
| E16 | Supported pattern is unavailable or disabled in the recorded rule set | Insufficient evidence plus preserved source | Do not present absent rule coverage as a successful negative comparison |
| E17 | Same request text occurs in different or unconfirmed target-system contexts | No strong correspondence or shared-root-cause claim | Current cycle membership alone does not verify system/client equivalence |

## 4. Human review and customer decisions: 0.9D

| ID | Synthetic input/action | Expected outcome |
|---|---|---|
| R01 | O2 tool status `UPLD_ERROR`, manual status `Uploaded` | Preserve both; comparison and customer approval remain independent and pending |
| R02 | O2 manual status `Out of scope` | Preserve annotation and evidence; request review, never auto-exclude or infer access permission |
| R03 | A reviewed out-of-scope decision has supporting shared-TR membership evidence | Keep it in the reviewed customer-report workflow under BR-001; report approval remains separate from customer access |
| R04 | No TR inventory; one object is A-only, another U-only | Neither absence establishes out-of-scope status |
| R05 | Reviewer adopts an imported annotation | Create a new explicit decision and audit event; do not edit imported status/comment fields |
| R06 | Reviewer rejects a suggested error relationship | Keep the automatic suggestion and a separate rejection; later GET/reload shows both |
| R07 | Reviewer confirms investigation context for a method under a class | Record confirmed `CONTEXT`; do not change the method's source type/name or imply subject identity |
| R08 | Reviewer changes a decision/note using current revision | Save decision and before/after audit event atomically |
| R09 | Two reviewers/tabs submit updates with the same old revision | First succeeds; stale write receives 409 without overwriting it |
| R10 | An identical run is requested again | Reuse completed results and existing decisions; no reset or duplicated evidence |
| R11 | Rule version or input source pair changes | New run, pending decisions; old decisions remain accessible and are not silently carried forward |
| R12 | Reviewer drafts an action for only one of several errors on an object | Save explicit evidence scope; do not treat the draft as approval of every message or a final exported row |
| R13 | Customer denies access or has not responded | No fabricated permission, resolution or readiness for the second run; handling remains a business question |

## 5. Empty inputs, persistence and isolation: 0.9A–0.9D

| ID | Synthetic input/operation | Expected outcome |
|---|---|---|
| X01 | Transformation workbook exists with headers only; post-upload has valid rows | Complete run with explicit empty-A warning, upload-only groups and retained messages |
| X02 | Both workbooks exist with all required sections headers-only | Complete zero-result draft with warnings, no invented objects or metrics |
| X03 | Upload `Objects` empty but `Errors` populated | All messages retained; no upload-object anchors; show their attribution limitations |
| X04 | Upload `Errors` empty but `Objects` populated | Object matching remains available; no invented detailed evidence |
| X05 | One workbook role not ingested | Future run API rejects with 409 `RECONCILIATION_INPUTS_INCOMPLETE`; no partial results or source changes |
| X06 | Several evidence pages, filter applied to the visible page | Run still covers the complete source pair, not only visible/filtered rows |
| X07 | Same input and versions with shuffled input-list iteration | Same semantic cases, reason codes and deterministic evidence order |
| X08 | Publish fails or concurrent identical requests collide | No partial visible result set; completed retry reuses one result; source rows unaffected |
| X09 | Review request names another cycle's evidence/target | Reject before writes; no cross-cycle decision, relationship or audit contamination |
| X10 | Source original Excel files are unavailable after ingestion | Engine can still use persisted raw/normalized records and metadata |
| X11 | Any browser acceptance test runs | Owned API 8001/UI 5174, fresh disposable database; never reuse 8000/5173 or normal database |
| X12 | Test assertions fail or cleanup ownership is unexpected | Follow existing isolation launcher: dispose only owned verified data; preserve unexpected files; never delete normal records |

## Acceptance sequence

1. **0.9A:** implement O01–O22 and applicable conservation/empty/determinism scenarios using in-memory synthetic records. Existing fixtures are examples of importer behavior, not evidence of SAP semantic truth.
2. **0.9B:** implement attribution and comparison tests only for enabled, justified rules. Keep unresolved mappings/context disabled or suggestion-only as specified; add negative examples before enabling stronger outcomes.
3. **0.9C:** test persistence, source-reference integrity, idempotency, pagination, complete-input checks and atomic failure handling against pytest temporary databases migrated by Alembic.
4. **0.9D:** test review/audit/concurrency behavior and accessible side-by-side evidence in isolated browsers. Keep report/export approval outside this step unless separately authorized.

No scenario above authorizes changing source workbooks, storing fixtures in the normal database, implementing a screen now or treating the standalone Downloads demo files as validated business ground truth.
