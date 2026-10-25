# Questions for seniors by build stage

Prepared on **2026-10-24**. Use this as a discussion checklist: take the questions for the current stage first, record answers, then revisit the next group when that stage begins. There is no need to resolve every future feature before building ingestion.

**Already clarified by the user:** an out-of-scope object is absent from the TR shared with the transformation team, so the team currently cannot see or access it in this workflow. It must be included in the customer-report workflow for revalidation and an access decision before the second run. Customers usually add it to the shared TR or provide another TR. See BR-001 through BR-003 in [mapping-rules.md](mapping-rules.md). Membership evidence, label ownership, decision authority and exception handling still need clarification.

At each stage, we will identify the relevant unanswered questions, explain what each answer changes, record your seniors' answers with their source/date, and distinguish decisions needed now from details that can wait. Questions alone are not new implementation requirements or authorization to advance milestones.

## Current stage — business meaning and workbook relationships

Track the answers here and take the remaining points to your seniors:

1. **Q0.1 — Scope criteria (definition answered):** User answer, 2026-10-24: an object is out of scope when it is not present in the TR shared with the transformation team, so the team currently cannot see or access it. See BR-002. **Remaining process questions:** who assigns the label, and which authoritative TR object list or other verified evidence confirms membership?
2. **Q0.2 — Requested access (usual mechanism answered):** User answer, 2026-10-24: customers mostly add the object to the shared TR or provide another TR. See BR-003. **Remaining process questions:** what evidence should the report provide, and what confirms that the TR change/access is available before the second run?
3. **Q0.3 — Customer decision:** Who on the customer side can approve or deny the request, and how is that decision communicated and recorded today?
4. **Q0.4 — Second run:** If access is denied or the customer has not responded, does the second run skip only those objects, wait entirely, or follow another process? Is actual access checked separately from customer approval?
5. **Q0.5 — Log structure:** Does a `S.No` restart mark one upload investigation, with its final summary row identifying the parent object? Can these exports be sorted, incomplete or contain repeated attempts?

**Why these matter:** the scope definition in Q0.1 is known, but applying it automatically requires authoritative membership evidence. Its remaining process questions and Q0.2–Q0.4 determine access handling and customer wording. Q0.5 determines whether component and unnamed messages can be associated safely with upload objects. Ingestion can preserve all raw rows while these process details remain unresolved; automatic scope classification and context linking need supported evidence and rules.

## Milestone 1 — backend ingestion

1. **Q1.1 — File origin:** Which fields are written by SmartTool and which are edited later? Can we obtain a pristine upload export alongside the annotated copy, and when are each of those snapshots taken?
2. **Q1.2 — Supported layouts:** Are these headers and sheets stable across projects/tool versions, and which layout variations must the first demo support?
3. **Q1.3 — Import problems:** When required identifiers or columns are missing, should an import be rejected or retained with warnings for review? Which problems make the entire report unusable?

**Output:** verified adapters and a documented validation policy; preserve manual annotations separately from tool evidence.

## Milestone 2 — reconciliation

1. **Q2.1 — Object relationships:** Is type + name authoritative for identity, and what documented relationships connect classes/methods, function groups/functions and programs/includes?
2. **Q2.2 — Finding identity:** When several messages/categories concern one object, which should become one finding and which remain separate? Are repeated object rows separate actions or duplicated annotations?
3. **Q2.3 — Comparison rules:** Which message patterns support each error category, and what should reviewers do with changed categories, unmatched objects and messages whose parent context cannot be confirmed?

**Output:** versioned identity/category rules with examples and explicit review fallbacks. Manual labels remain separate from automatic classification during evaluation.

## Milestone 3 — human review

1. **Q3.1 — Responsibilities:** Who can edit a finding, approve the customer report, and override a previous decision? Is one reviewer sufficient for the demo?
2. **Q3.2 — Existing annotations:** How should previously entered statuses/comments appear in a new review? Which checks are required before a reviewer adopts them?
3. **Q3.3 — Edits and reruns:** After a source re-upload or repeated reconciliation, which reviewer decisions remain valid and which must be reviewed again? What audit details are needed?

**Output:** a clear review/approval workflow that preserves evidence and does not confuse internal approval with customer access permission.

## Milestone 4 — customer report and access requests

1. **Q4.1 — Placement:** Should out-of-scope entries remain in `Error details`, as in the sample, or use a separately agreed section? Must the existing five-column and three-column layouts be preserved exactly?
2. **Q4.2 — Customer wording:** What must each entry contain: reason for revalidation, exact requested access, customer decision owner, next step or response reference? Can these fit in `Comments`, or is an agreed format change needed?
3. **Q4.3 — Recheck and summary:** Should recheck objects appear in both sheets, which comments apply to each, and what summary should the customer receive? Are internal audit details permitted in the delivered workbook?

**Output:** an agreed export contract retaining out-of-scope customer-decision requests and reviewed rechecks, without inventing owners or access decisions.

## Milestone 5 — Smart Blocker Radar

1. **Q5.1 — Shared context:** Can the same transport/layer identifier refer to different systems or clients? What context must agree before we suggest a shared blocker?
2. **Q5.2 — Group decisions:** Who confirms or dismisses a suggested group, and what evidence is enough to accept that its objects share an investigation?
3. **Q5.3 — Useful guidance:** Which investigation steps and responsible teams are appropriate for each supported blocker type?

**Output:** evidence-supported investigation groups with approved explanatory wording. A group does not approve its member findings or establish a proven root cause.

## Milestone 6 — optional AI explanations

1. **Q6.1 — Data permission:** Is any customer evidence allowed to leave the local environment, and what must be removed or anonymized first?
2. **Q6.2 — Service choice:** Which provider, account and retention settings are approved, if any? Should the demo remain in offline/template mode?
3. **Q6.3 — Useful assistance:** Would plain-language explanations or suggested investigation checks help reviewers most, and who will assess whether the explanations are useful and supported?

**Output:** a bounded, optional explanation feature only if approved. Existing constraints remain: source citations, clear suggestion labels, no changes to source facts or approval decisions.

## Milestone 7 — evaluation, demo and next cycle

1. **Q7.1 — Reference quality:** Who can validate the customer reference and a set of correct object/finding correspondences? Which known mistakes or exceptions must evaluation account for?
2. **Q7.2 — Success measurements:** What manual baseline and assisted workflow should we time, and what accuracy/review-burden targets would make the demo useful?
3. **Q7.3 — Cycle continuity:** What records prove customer decisions and access availability before the second run, how do we establish the next run's object scope, and what should happen if access later changes?

**Output:** honest measured results and a documented next-cycle process. Cross-cycle automation remains later scope unless separately authorized.

## Record answers

For each answer, bring back:

```text
Question ID:
Answer:
Answered by (role/name):
Date:
Example or evidence:
Confirmed decision or provisional guidance:
```

Store confirmed rules in [mapping-rules.md](mapping-rules.md), link related questions, and update relevant discovery/implementation documentation. Do not mark a question answered until an actual answer is available; the sample workbook alone cannot supply business authorization.
