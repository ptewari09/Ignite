# Business and mapping rules

Version **0.3**, updated on **2026-10-24**. This register separates user-confirmed requirements from workbook observations and technical proposals. The business rules here are not implemented by the backend foundation. See [RECONCILIATION_DISCOVERY.md](RECONCILIATION_DISCOVERY.md) for evidence and [SENIOR_QUESTIONS.md](SENIOR_QUESTIONS.md) for remaining decisions.

## BR-001 — report out-of-scope objects for a customer decision

**Status:** confirmed by the user in this conversation on 2026-10-24. The process details listed below remain open for senior clarification; this is not a claim that a senior has signed them off.

**User clarification:** out-of-scope objects need to be sent in the report to the customer for revalidation and a decision on whether to grant access before the second run.

**Requirement:** retain objects identified as `Out of scope` in the reviewed customer-report workflow so the customer can revalidate them and decide whether to grant the required access before the second run. Preserve the label and supporting evidence. The label must not cause an object to disappear from the report selection.

The report requests a customer decision; preparing or approving the report does not establish that access has been granted. Whether that decision permits a particular object or the whole next run to proceed still needs clarification. This requirement describes the report's purpose, not an instruction to send a report from this workspace.

### Consequences for later implementation

- Keep scope/access meaning separate from report inclusion. An out-of-scope object needs customer visibility even though permission to work on it has not been established.
- Apply the requirement to reviewed classifications. A raw message, imported manual label or AI suggestion must not silently become an approved classification or approved customer instruction.
- Once reviewed and approved for reporting, an out-of-scope entry must be retained with its label, provenance and reviewer-approved explanation/request. Do not automatically map `Out of scope` to reviewer disposition `EXCLUDE`.
- Keep internal report approval separate from the customer's access decision. Do not infer permission, completion or resolution from inclusion in an exported workbook.
- BR-002 below defines out-of-scope objects using shared-TR membership. Evidence for checking that membership automatically, report placement and customer-response recording remain unresolved. No new status enum, database field or access-control behavior is prescribed yet.

### Future acceptance examples

| Situation | Required behavior |
|---|---|
| A reviewer approves an `Out of scope` entry for the customer report | Export retains it for revalidation/access decision, with its approved explanation and supporting source links kept internally |
| An imported annotation says `Out of scope`, but has not been reviewed | Preserve it and surface the review requirement; do not silently discard it or export it as approved |
| A report containing an out-of-scope object is approved internally | Customer access remains unconfirmed until a separate customer decision/evidence exists |
| The customer has not responded or denies access | Do not fabricate permission or mark the issue resolved; next-run handling awaits an agreed rule |
| A finding is `NO_TLAYER` or `NO_TRANS_ROUTE` | Do not infer `Out of scope` from that category alone; use the shared-TR membership definition in BR-002 |

These examples specify future checks, not existing executable tests. The eight out-of-scope rows observed in the customer reference are consistent with this reporting purpose; their technical categories alone do not establish how to classify other objects.

### Open details

Use the current-stage questions in [SENIOR_QUESTIONS.md](SENIOR_QUESTIONS.md) to clarify authoritative TR-membership evidence, label ownership, required access, decision authority, response evidence and next-run handling. Export layout and recheck relationships are covered under Milestone 4 there.

## BR-002 — out-of-scope definition uses the TR shared with Smartshift

**Status:** definition confirmed by the user on 2026-10-24, answering the definition portion of Q0.1. Who assigns the label and how membership is verified remain open.

**Definition:** an object is `Out of scope` when it is not present in the TR shared with Smartshift. The user explains that Smartshift currently cannot see or access that object in this workflow. BR-001 requires reporting it to the customer for revalidation and an access decision before the second run.

This is the user's business definition for this project. It is not a general SAP permission rule. The actual shared-TR object inventory and a verified method for comparing parent/component identities have not been established from the supplied workbooks.

### Consequences for later implementation

- Check scope against verified membership of the applicable shared TR, separately from object/error reconciliation between A and B.
- Absence from A, B or the customer reference does not establish absence from the shared TR. Keep `TRANSFORMATION_ONLY` and `UPLOAD_ONLY` separate from scope classification.
- Automatic classification needs authoritative, sufficiently complete TR-membership evidence and validated identity rules. Until that is available, retain a reviewed scope decision with its evidence or leave scope unconfirmed. Missing membership data must not mark every object out of scope.
- TR presence alone must not be treated as proof that every permission or prerequisite for upload is satisfied.
- No additional upload input or TR importer is being required or implemented by this clarification. The form of membership evidence remains open; BR-003 records the usual customer process for making an object accessible.

### Future acceptance examples

| Evidence | Expected behavior |
|---|---|
| Verified applicable TR inventory confirms an object is absent | Classify it as out of scope under this definition; retain it in the reviewed customer-report workflow under BR-001 |
| An object is upload-only or transformation-only, with TR membership unknown | Preserve that reconciliation status; do not infer scope from report absence |
| No authoritative TR inventory or reviewed membership evidence is available | Leave scope unconfirmed; do not assume nonmembership |
| An object is present in the shared TR but has an upload error | Evaluate the actual error evidence; do not infer that the error means the object is absent from the TR |

These are future acceptance examples, not implemented rules or executed tests. The sample's eight `Out of scope` labels have not been independently verified against an authoritative TR inventory.

## BR-003 — usual customer response is to provide TR coverage

**Status:** usual process confirmed by the user on 2026-10-24, answering the mechanism portion of Q0.2. The user said customers mostly add the object to the shared TR or provide another TR. Preserve this as the usual process, not an exhaustive guarantee about every case.

For future reviewed reports, a lead can request the appropriate TR addition/provision after customer revalidation. Do not infer that a TR has been updated, access is operational, or the object is ready for the second run until supporting confirmation exists. Decision authority, response evidence and denial/no-response handling remain open. No TR integration or automatic scope change is implemented in Prompt 0.2.

## Change record

| Version | Date | Source | Change |
|---|---|---|---|
| 0.1 | 2026-10-24 | User clarification in this conversation | Added BR-001: customer reporting of out-of-scope objects for revalidation/access decision before the second run |
| 0.2 | 2026-10-24 | User answer to Q0.1 in this conversation | Added BR-002: object absent from the TR shared with Smartshift; current visibility/access unavailable in this workflow |
| 0.3 | 2026-10-24 | User answer to Q0.2 in this conversation | Added BR-003: customers usually add the object to the shared TR or provide another TR |

For each future answer, record the question ID, answer, person/role, date, an example and rule impact. Label provisional interpretations explicitly. Update affected documentation and plan an acceptance check before implementing a rule.
