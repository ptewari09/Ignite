# Reconciliation open questions

Version 0.4, 2026-10-28. Reconciliation question register for the transformation lead/tool owner. No business answers are assumed. Source-layout compatibility and the conservative [pure object matcher](OBJECT_MATCHER.md) are implemented; remaining export-contract/semantic questions stay open. This supplements [SENIOR_QUESTIONS.md](SENIOR_QUESTIONS.md); confirmed business rules remain in [mapping-rules.md](mapping-rules.md). [Cross-dataset findings](CROSS_DATASET_FINDINGS.md) supply observations, not SAP approvals.

## Decisions already supplied by the user

Do not ask these again as unanswered definitions:

- **BR-001:** reviewed out-of-scope objects must reach the customer-report workflow for revalidation and an access decision before the second run.
- **BR-002:** in this project, out of scope means absent from the TR shared with the transformation team, so the team currently cannot see/access the object in this workflow. This is not a universal SAP authorization rule.
- **BR-003:** the customer usually adds the object to that TR or supplies another TR.

These do not answer how membership is proven, who may approve a customer action, whether a customer has responded, or whether the next upload may proceed.

## Priorities by implementation stage

| Stage | Most useful answers | Safe progress while answers are pending |
|---|---|---|
| Known source-layout compatibility, completed | Q-13 for future export guarantees | Both known layouts now ingest; preserve missingness/provenance and reject unknown or ambiguous layouts. This no longer blocks 0.9A |
| 0.9A: object matching, complete | Q-01 and Q-03 remain open | Checked typed comparisons implemented; missing types/collisions require review without name-only links, parent aliases or inferred scope |
| 0.9B: attribution/error comparison | Q-02, Q-04, Q-05 and Q-06 | Explicit subject links and bounded, evidence-supported suggestions; disable unverified block rules and strong category mappings |
| 0.9C: result persistence/APIs | Q-07 and Q-10 | Cycle-scoped snapshots, immutable evidence and preserved old runs; no automatic decision carry-forward |
| 0.9D: human review | Q-07, Q-08 and Q-09 | Save pending draft actions and explicit relationship decisions; no implied report approval or access permission |
| Later evaluation/reporting/ML research | Q-08 through Q-12 and Q-14 | Document limitations and measured processing counts; no unmeasured accuracy, inferred training labels, inclusion or time-saving claims |

The gaps did not prevent conservative object matching. Its technical guards do not answer Q-01/Q-03 or approve SAP semantics. Before implementing 0.9B, prioritize Q-02/Q-04/Q-05/Q-06; leave unsupported context/category rules disabled. A missing answer must restrict only the behavior that depends on it.

## Questions for the next technical discussion

### Q-01 — Which identifier comparisons are authoritative?

**Ask:** Are object names case-insensitive for every relevant type/export? Which type tokens are supported? Can internal whitespace or non-ASCII names be meaningful? Is there an authoritative parent/component map for classes/methods and function groups/functions/programs?

**Why:** the importer normalizes whitespace/case, but that is a text convention, not a complete SAP identity contract. Similar names and conflicting types can represent different subjects.

**Cross-dataset evidence:** internal spaces occur in 113/160 transformation fields, while D2 padding changes 161 object-list names. D2 also has one name with two transformation types, neither in the upload list. Preserve typed groups and compound-looking fields; do not ask the reviewer to endorse arbitrary stripping or a name-only merge.

**Request:** sanitized positive and negative examples plus any tool schema/type documentation; specifically include same-name/different-type and component-parent cases.

**Until answered:** preserve punctuation; automatically compare only safe, complete typed keys; name-only, non-text, risky normalization and unknown-type cases require review. No fuzzy or parent inference. Affects O-01 through O-07.

### Q-02 — Is the observed log-block layout guaranteed?

**Ask:** Which boundary/ordinal contract applies to each export profile? D1 resets at 1, while D2 has unique increasing ordinals with gaps. Are those ordinals block-local, global or retained source-row IDs? Does a terminal named typed row identify an investigation parent in either format? Can logs be sorted, concatenated, partial or filtered, and how is that declared?

**Why:** D2 disproves a universal reset-at-1 assumption. Its 170 blank-severity terminal candidates include 23 unlisted subjects and omit one listed key; treating the entire log as one reset-based range conflicts with 523 direct rows. Do not infer a filtering/deletion history merely from ordinal gaps. Adjacency, blank severity and sequence alone cannot establish parent context.

**Request:** tool-owner confirmation and sanitized examples of a complete block, a component subject, an unnamed message, a broken block and a repeated object.

**Until answered:** explicit subject keys remain usable; block ranges are diagnostic potential context only, with automatic attachment disabled. Never forward-fill identity. Affects A-04 and coverage for non-direct messages.

### Q-03 — What does presence/absence between the reports mean?

**Ask:** Is transformation output a complete intended-upload inventory or only findings? Does post-upload `Objects` list attempts, failures, selected objects or something else? Do both files cover the same system/client, scope and run? Which metadata proves this?

**Why:** current workbooks/cycles have no dedicated target-system/client or source-run identity contract. A transformation-only entry is not automatically a missed change; an upload-only entry is not automatically a new defect.

**Request:** a process description and a sanitized example where an expected object intentionally appears in only one report.

**Until answered:** describe observed presence only, capture context as unconfirmed and prevent claims about success/failure or shared root cause. Do not add another required upload input in 0.9A.

### Q-04 — What defines corresponding error evidence?

**Ask:** For each of `OBJ_LOCKED`, `NO_TLAYER`, `NO_TRANS_ROUTE`, `EDITOR_LOCK`, `NO_DEVC` and `SAP_OB`, what does the category mean in the transformation phase? Which exact upload templates/codes are valid counterparts? Must request/layer/package identifiers agree? How are negation, historical statements, quoted diagnostics and changed prerequisites handled?

**Why:** upload logs have no equivalent structured category column; generic keywords and co-occurring transformation categories do not establish correspondence. Route/layer and standard-object/editor observations particularly resist one-to-one mapping.

**Request:** a small reviewed set of positive pairs, non-equivalent pairs and unresolved pairs for each category. Include different requests/layers and multiple transformation findings on one object. If another export contains structured message class/number fields, provide its schema rather than inventing those columns.

**Until answered:** keep unvalidated mappings unresolved. Lock/layer themes are the first candidate investigations; stronger outcomes require validated patterns and evidence. No mapping based on manual labels or the customer reference.

**Cross-dataset evidence:** D2 has no `NO_TRANS_ROUTE` transformation category; its `NO_DEVC` rows co-occur with `NO_TLAYER`, whereas D1 pairs them with `NO_TRANS_ROUTE`. Both bundles have editor wording on objects with multiple categories. No fixed synonym, companion-category or error-equivalence rule follows.

### Q-05 — When is a message a subject error versus investigation context?

**Ask:** Can a row name a dependency/component while another row names the uploaded parent? Can multiple parents share one technical message? Does a name in free text denote the failing object, a related object or merely quoted context? Which severity/blank-summary conventions have documented meaning?

**Why:** direct identity, parent context and diagnosis are distinct. `Errors` also contains informational and summary messages.

**Request:** sanitized examples with explicit descriptions of subject, parent and diagnosis; specify any supported many-to-many relationship.

**Until answered:** preserve subject fields; attach only justified explicit subject links; mark body references and parent relationships as potential/context with uncertainty.

### Q-06 — Are the exported messages complete and stable?

**Ask:** Are long messages truncated upstream? Are message texts translated, version-dependent or configurable? Can exact templates be tied to a tool/export version? Does row order reflect a stable execution order?

**Why:** the inspected technical messages have a fixed raw width, and workbook metadata currently has no importer/export-format version field. Truncated IDs and translated text undermine extraction rules.

**Cross-dataset evidence:** raw widths differ, 194 characters in D1 versus 191 in D2. Ask about the actual export limits rather than treating either width as a universal maximum or proof of truncation.

**Request:** a format/version description and a sanitized full-versus-exported message example if truncation exists.

**Until answered:** missing/partial identifiers remain unknown; version every pattern and normalization rule; preserve raw text and label unavailable context. Do not silently recover text from another row.

### Q-07 — How should imported and new human decisions interact?

**Ask:** Who added manual statuses/comments, when and based on which checks? What does `Uploaded` assert despite `UPLD_ERROR`? Are repeated object rows separate actions or conflicting notes? Who may confirm/reject links, revise notes and approve customer actions? Should a changed rule/source require fresh review, and who may explicitly adopt old decisions?

**Why:** D1 imports contain no annotation-author/timestamp/approval contract. D2's raw object list omits manual/status fields altogether, while its separate reference contains statuses/comments. Preserving those different origins is essential; reference labels must not be copied into missing source columns or assumed verified.

**Request:** a short decision lifecycle with a repeated-object example and a rerun example. Specify whether one local reviewer is sufficient for the demo.

**Until answered:** imported annotations remain read-only; new actions are drafts; decisions require explicit audit events; identical runs preserve decisions and changed runs do not carry them automatically. Demo actor labels are recorded, not authenticated identities.

### Q-08 — What makes one customer action, and what belongs in the report?

**Ask:** Can one object have several customer actions, and can one action cover several objects? Which findings should be included, excluded or marked recheck? Which fields, ownership, evidence and approval are mandatory? Do rechecks also remain in error details?

**Why:** object groups and source rows do not define action granularity. The existing report is curated; emitting every upload message would invent an inclusion rule.

**Cross-dataset evidence:** D2 has up to 15 object-list rows per typed key and differing reference comments on repeated keys. One reference key has no directly matching typed message in the raw log; ask what additional investigation supports that action. Its reference uses `Error log` and has no `Recheck` tab. Confirm action identity and the agreed output layout; absence of a tab is not a business decision that no rechecks are needed.

**Request:** sanitized examples showing multiple errors on one object, a shared prerequisite across objects, exclusion and recheck placement.

**Until answered:** preserve all evidence and record explicitly scoped action drafts. Do not auto-approve or export them; do not interpret multiplicity as one action or one source row per final report row. Export is a later milestone.

### Q-09 — How is shared-TR membership/access evidenced?

**Ask:** Which applicable TR inventory or reviewer evidence establishes membership? Who may confirm the out-of-scope label? What evidence records the customer's decision and proves that adding/supplying a TR made access operational? What happens on denial, partial access or no response before the second run?

**Why:** the definition and reporting purpose are already confirmed, but a technical layer/route error or report absence is not a membership check. Internal approval is not customer permission.

**Cross-dataset evidence:** D1's reference has eight out-of-scope entries and D2's has none. Neither supplies authoritative applicable-TR inventory; the difference does not imply D2 is entirely in scope.

**Request:** the evidence format and decision authority, plus one sanitized grant/deny/no-response workflow. This is discovery, not a request to build a TR importer now.

**Until answered:** retain out-of-scope annotations, leave unsupported scope/access unconfirmed and preserve reviewed entries for customer revalidation. Do not infer permission or next-run readiness.

### Q-10 — What must be reproducible in a reconciliation run?

**Ask:** Is a run permanently tied to its exact source pair and rule version? How should reviewers select the current run after rules change? Must rejected relationships, notes and failed attempts remain inspectable, and for how long?

**Why:** automatic recomputation must not erase manual work. Retention and shared deployment may eventually require policy beyond a local demo.

**Request:** agreement on immutable run history and explicit review adoption, or a documented alternative. Confirm any later retention requirements.

**Until answered:** snapshot versions/inputs, reuse identical completed runs, preserve old runs and append audit events. No deletion, automatic carry-forward or background expiry in the initial design.

### Q-11 — What is the evaluation ground truth?

**Ask:** Who will validate object matches, message attribution and error pairs independently? Is the customer reference final/correct or illustrative? Which cases should remain undecidable? What measured manual workflow is a fair time baseline?

**Why:** reproducing manual annotations or the reference's curated rows is not independent validation of matching. Synthetic expected behavior tests code, not business accuracy.

**Request:** an authorized, reviewed evaluation set with provenance and separate technical/business labels; measure human review time on comparable work.

**Until answered:** report source counts, coverage, ambiguity, rule versions and processing latency only when measured. No claimed matching precision/recall, resolution rate or time savings.

**Cross-dataset evidence:** no reliable matched/unmatched pair labels have been established. Human-looking reference rows and D1 manual annotations are not independently verified correspondence labels. The two bundles share objects/text, and their actual project/cycle independence is unknown; see Q-14 before any ML evaluation.

### Q-12 — Which review/report wording and data handling are approved?

**Ask:** What language should distinguish possible correspondence, confirmed investigation context and approved customer action? Which internal metadata may appear in customer output? What local demo, screenshot and retention permissions apply?

**Why:** raw technical evidence and imported comments may be sensitive or unsuitable for customer presentation. The project has no need for external AI to implement matching.

**Request:** approved wording and data-use boundaries. No external messages, uploads or AI services are authorized by this design task.

**Until answered:** use synthetic examples in committed docs/tests, keep originals/local outputs ignored, preserve internal provenance and keep customer output/AI outside the implementation steps proposed here.

### Q-13 — Which source-layout profiles and absent fields should be supported?

**Ask:** Confirm the intended roles of the header-identified D2 tables and which fields are mandatory for each source profile. Should the three-column raw identity list be supported with tool/manual status fields explicitly not supplied? Which aliases/export versions are stable, and how should ambiguous profile detection be rejected?

**Why:** the current transformation workbook gate requires `Detailed_LOG`, while D2 has `Detailed_Log`. The upload gate requires `Objects`/`Errors`, while D2 uses `Sheet1`/`Sheet2`; its object table additionally lacks four required columns. Row-adapter probes show compatible transformation/message fields but an incompatible object contract. Renaming alone is insufficient.

**Request:** an agreed profile/field-availability contract and, if available, the export procedure/version. Clarify whether absent status is expected or reflects a reduced export; do not fabricate a status from an icon, filename or final customer report.

**Discovery-stage boundary before 0.8C:** record the compatibility gap without changing parsers, populating fields or altering originals. Existing nullable model fields could represent missing values, but the old parser contract rejected the source. Compatibility required its own authorization, subsequently supplied for 0.8C.

**Technical status after 0.8C:** the separately authorized compatibility task accepts both known source layouts under [INGESTION_LAYOUTS.md](INGESTION_LAYOUTS.md), preserving missing fields with existing nullable columns/raw payloads. The preceding paragraph records the discovery-stage boundary. No migration or reference-label enrichment was needed. Remaining questions concern export guarantees, future profiles and field meaning, not the resolved ability to ingest these four source files.

### Q-14 — What task, labels and independent groups would support future ML?

**Ask:** Is the target object identity, message-parent attribution or error correspondence? Who can independently label positive, negative and uncertain pairs, adjudicate disagreements and authorize local data use? Which verified project/cycle/system/run IDs define groups, and can more independent groups be supplied for training, validation and held-out testing?

**Why:** two bundles do not provide a verified three-way group split. They share 28 transformation typed keys and 63 distinct trimmed technical texts; row-random splitting can leak objects/templates. Neither automatically inferred key equality nor a curated report supplies reliable semantic pair truth or negatives for excluded entries.

**Request:** a documented annotation guide, pair IDs/provenance, reviewer agreement/adjudication, task-specific labels and verified grouping/collection metadata. Agree an untouched test set before tuning and include hard negatives with similar objects/categories but different evidence.

**Until answered:** only specify features/evaluation. Do not train/download/integrate a model, send data externally, invent project IDs from filenames or treat pseudo-labels as ground truth. Future work should compare against the deterministic baseline and report abstention/coverage/review burden with precision/recall.

## Recording answers without inventing certainty

For an answer, record question ID, respondent/role, date, confirmed versus provisional guidance, sanitized supporting examples, affected rule IDs, required negative tests and approved rule version. Link to existing senior questions rather than duplicating conflicting answers.

Only actual answers may update the confirmed business-rule register. Update the rules, matrix and architecture together when a decision changes a contract. A clear unresolved label is preferable to a plausible but unverified rule.
