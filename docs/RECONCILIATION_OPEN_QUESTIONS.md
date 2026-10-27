# Reconciliation open questions

Version 0.1, 2026-10-27. Milestone 0.8 question register for the transformation lead/tool owner. No answers below are assumed. This supplements [SENIOR_QUESTIONS.md](SENIOR_QUESTIONS.md); confirmed rules remain in [mapping-rules.md](mapping-rules.md).

## Decisions already supplied by the user

Do not ask these again as unanswered definitions:

- **BR-001:** reviewed out-of-scope objects must reach the customer-report workflow for revalidation and an access decision before the second run.
- **BR-002:** in this project, out of scope means absent from the TR shared with the transformation team, so the team currently cannot see/access the object in this workflow. This is not a universal SAP authorization rule.
- **BR-003:** the customer usually adds the object to that TR or supplies another TR.

These do not answer how membership is proven, who may approve a customer action, whether a customer has responded, or whether the next upload may proceed.

## Priorities by implementation stage

| Stage | Most useful answers | Safe progress while answers are pending |
|---|---|---|
| 0.9A: object matching | Q-01 and Q-03 | Exact safe typed comparisons; uncertain identities remain visible; no parent aliases or inferred scope |
| 0.9B: attribution/error comparison | Q-02, Q-04, Q-05 and Q-06 | Explicit subject links and bounded, evidence-supported suggestions; disable unverified block rules and strong category mappings |
| 0.9C: result persistence/APIs | Q-07 and Q-10 | Cycle-scoped snapshots, immutable evidence and preserved old runs; no automatic decision carry-forward |
| 0.9D: human review | Q-07, Q-08 and Q-09 | Save pending draft actions and explicit relationship decisions; no implied report approval or access permission |
| Later evaluation/reporting | Q-08 through Q-12 | Document limitations and measured processing counts; no unmeasured accuracy, inclusion or time-saving claims |

The gaps do not prevent a conservative 0.9A implementation once that next milestone is authorized. A missing answer must restrict only the behavior that depends on it.

## Questions for the next technical discussion

### Q-01 — Which identifier comparisons are authoritative?

**Ask:** Are object names case-insensitive for every relevant type/export? Which type tokens are supported? Can internal whitespace or non-ASCII names be meaningful? Is there an authoritative parent/component map for classes/methods and function groups/functions/programs?

**Why:** the importer normalizes whitespace/case, but that is a text convention, not a complete SAP identity contract. Similar names and conflicting types can represent different subjects.

**Request:** sanitized positive and negative examples plus any tool schema/type documentation; specifically include same-name/different-type and component-parent cases.

**Until answered:** preserve punctuation; automatically compare only safe, complete typed keys; name-only, non-text, risky normalization and unknown-type cases require review. No fuzzy or parent inference. Affects O-01 through O-07.

### Q-02 — Is the observed log-block layout guaranteed?

**Ask:** Does `Errors.S.No` restart at 1 for each investigation? Is its last named typed row the investigation parent? Are its blank severity/icon and sequence conventions documented? Can users sort logs, concatenate runs, omit rows or receive partial/repeated blocks? What identifies boundaries and parents in those cases?

**Why:** the inspected copy has consistent terminal anchors, but adjacency/sequence alone is not proof that all messages belong to that parent. Ingestion intentionally accepts more layouts than this one observed pattern.

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

### Q-05 — When is a message a subject error versus investigation context?

**Ask:** Can a row name a dependency/component while another row names the uploaded parent? Can multiple parents share one technical message? Does a name in free text denote the failing object, a related object or merely quoted context? Which severity/blank-summary conventions have documented meaning?

**Why:** direct identity, parent context and diagnosis are distinct. `Errors` also contains informational and summary messages.

**Request:** sanitized examples with explicit descriptions of subject, parent and diagnosis; specify any supported many-to-many relationship.

**Until answered:** preserve subject fields; attach only justified explicit subject links; mark body references and parent relationships as potential/context with uncertainty.

### Q-06 — Are the exported messages complete and stable?

**Ask:** Are long messages truncated upstream? Are message texts translated, version-dependent or configurable? Can exact templates be tied to a tool/export version? Does row order reflect a stable execution order?

**Why:** the inspected technical messages have a fixed raw width, and workbook metadata currently has no importer/export-format version field. Truncated IDs and translated text undermine extraction rules.

**Request:** a format/version description and a sanitized full-versus-exported message example if truncation exists.

**Until answered:** missing/partial identifiers remain unknown; version every pattern and normalization rule; preserve raw text and label unavailable context. Do not silently recover text from another row.

### Q-07 — How should imported and new human decisions interact?

**Ask:** Who added manual statuses/comments, when and based on which checks? What does `Uploaded` assert despite `UPLD_ERROR`? Are repeated object rows separate actions or conflicting notes? Who may confirm/reject links, revise notes and approve customer actions? Should a changed rule/source require fresh review, and who may explicitly adopt old decisions?

**Why:** existing imports contain no annotation-author/timestamp/approval contract. Preserving a label is different from treating it as a verified conclusion.

**Request:** a short decision lifecycle with a repeated-object example and a rerun example. Specify whether one local reviewer is sufficient for the demo.

**Until answered:** imported annotations remain read-only; new actions are drafts; decisions require explicit audit events; identical runs preserve decisions and changed runs do not carry them automatically. Demo actor labels are recorded, not authenticated identities.

### Q-08 — What makes one customer action, and what belongs in the report?

**Ask:** Can one object have several customer actions, and can one action cover several objects? Which findings should be included, excluded or marked recheck? Which fields, ownership, evidence and approval are mandatory? Do rechecks also remain in error details?

**Why:** object groups and source rows do not define action granularity. The existing report is curated; emitting every upload message would invent an inclusion rule.

**Request:** sanitized examples showing multiple errors on one object, a shared prerequisite across objects, exclusion and recheck placement.

**Until answered:** preserve all evidence and record explicitly scoped action drafts. Do not auto-approve or export them; do not interpret multiplicity as one action or one source row per final report row. Export is a later milestone.

### Q-09 — How is shared-TR membership/access evidenced?

**Ask:** Which applicable TR inventory or reviewer evidence establishes membership? Who may confirm the out-of-scope label? What evidence records the customer's decision and proves that adding/supplying a TR made access operational? What happens on denial, partial access or no response before the second run?

**Why:** the definition and reporting purpose are already confirmed, but a technical layer/route error or report absence is not a membership check. Internal approval is not customer permission.

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

### Q-12 — Which review/report wording and data handling are approved?

**Ask:** What language should distinguish possible correspondence, confirmed investigation context and approved customer action? Which internal metadata may appear in customer output? What local demo, screenshot and retention permissions apply?

**Why:** raw technical evidence and imported comments may be sensitive or unsuitable for customer presentation. The project has no need for external AI to implement matching.

**Request:** approved wording and data-use boundaries. No external messages, uploads or AI services are authorized by this design task.

**Until answered:** use synthetic examples in committed docs/tests, keep originals/local outputs ignored, preserve internal provenance and keep customer output/AI outside the implementation steps proposed here.

## Recording answers without inventing certainty

For an answer, record question ID, respondent/role, date, confirmed versus provisional guidance, sanitized supporting examples, affected rule IDs, required negative tests and approved rule version. Link to existing senior questions rather than duplicating conflicting answers.

Only actual answers may update the confirmed business-rule register. Update the rules, matrix and architecture together when a decision changes a contract. A clear unresolved label is preferable to a plausible but unverified rule.
