# Reconciliation discovery

Status: **workbook observations, proposed technical rules and dated business clarifications**, 2026-10-24. No reconciliation engine, importer adapter, customer-action classifier or blocker grouping is implemented. Source schemas and category frequencies are in [DATA_DICTIONARY.md](DATA_DICTIONARY.md). All exploration was local and read-only. Confirmed user guidance is recorded separately in [mapping-rules.md](mapping-rules.md); stage-specific discussion questions are in [SENIOR_QUESTIONS.md](SENIOR_QUESTIONS.md).

## What can be established from these files

Object identity and finding identity must be separate. An object is the thing being examined; a finding is evidence about it. A name match establishes neither error equivalence nor remediation success. Reviewer labels form a third dimension and are not raw tool classifications.

Exploratory comparisons used uppercase names and type codes with Unicode whitespace trimmed/collapsed. Underscores, namespace markers, suffixes and component separators were retained. The 309 A names, 203 B object names and 151 C detail names already needed no normalization changes. B type codes do need trimming. These counts describe this sample; they are not measured precision or recall.

| Comparison | Observed distinct identities | Interpretation |
|---|---:|---|
| A `Detailed_LOG` names | 309 | Initial transformation objects/components |
| B `Objects` names | 203 | Upload objects |
| A ∩ B, normalized name | 172 | Candidate same-name identities |
| A ∩ B, normalized `(type, name)` | 172 | All 172 shared names also have matching type codes |
| A names absent from B `Objects` | 137 | Transformation-only in this direct comparison |
| B names absent from A `Detailed_LOG` | 31 | Upload-only in this direct comparison |
| C `Error details` names found in B | 151 of 151 | Customer reference is a curated subset |
| B names absent from C details | 52 | Selection reasons cannot be inferred from absence |
| C `Recheck` names found in B and C details | 4 of 4 | Recheck membership overlaps the detail list |

Do not describe 172 as successfully remediated objects, 31 as new automation defects, or 137 as missed changes. A and B may cover different scopes and object granularity.

## Proposed object keys

1. Use `(normalized Object Type, normalized Object Name)` to propose exact identity matches. The column is called `Object Type` in A and `Object Typ` in B. Preserve raw spellings and source rows.
2. Treat a name-only equality with missing or conflicting type as a candidate requiring review. This matters particularly in detailed logs: 31 `Errors` names have multiple type codes.
3. Preserve every row behind a key. A has multiple distinct categories per repeated key; B has repeated object keys with different manual comments. A key identifies an object, not a unique spreadsheet record or customer action.
4. Treat component/parent relationships as explicit links, with method and evidence recorded separately. Do not strip method delimiters or assume a `PROG`, `FUNC` or `METH` is interchangeable with a `FUGR` or `CLAS`.

For persistence, `(source_file_id, sheet_name, Excel row number)` is a useful record location. A file hash identifies a particular source version. Neither the empty A `File Name` column nor B `S.No` can serve as a global object key.

These are proposals for later implementation, not approved SAP semantic rules. The absence of A↔B type conflicts among the shared names supports a conservative starting point but does not establish general matching accuracy.

## How B's detailed messages relate to objects

A direct `(Errors.Object Typ, Errors.Object Name)` comparison with B `Objects` produces:

| Message-row case | Rows |
|---|---:|
| Exact typed key found in B `Objects` | 804 |
| Same name as B object, different type | 33 |
| Named subject absent from B object names | 224 |
| Blank subject name and type | 165 |
| **Total** | **1,226** |

The 33 type conflicts consist of 13 `METH`, 11 `PROG` and nine `FUNC` rows. Across all named logs, 175 names are absent from B `Objects`. These may be components or related subjects; absence does not prove that a message is unrelated or an orphan.

All 203 B object keys have at least one directly matching message. Of the 804 direct-key rows, 794 have one physical B target row and ten refer to one of the two repeated object keys. Those ten rows can identify a shared canonical object, but cannot select between distinct manual comment rows on identity alone. A direct join would otherwise multiply evidence rows.

### A promising block-context association

Observed structure:

- `S.No` restarts at 1 exactly 203 times, producing 203 contiguous blocks with consecutive ordinals.
- Every block ends with a named typed row, blank `Type`, and icon `@77\Q@`.
- The 203 terminal typed keys are unique and equal the full set of B `Objects` keys.
- Every direct-key message within a block agrees with that block's terminal object. There are no direct-key conflicts with another listed upload object in this sample.
- The remaining **422 rows** comprise the 33 type conflicts, 224 other named subjects and 165 unnamed subjects. Their block context is observable even where a direct object join fails.

For example, `Errors` rows 18–28 form an 11-message block ending in a listed `FUGR` object. Seven preceding rows have blank identifiers. Rows 12–17 form another block: its terminal object is `CLAS`, while row 16 uses `METH`. These are useful test cases once the relationship is confirmed.

**Proposal to validate:** preserve each contiguous block and associate its messages with the terminal upload object, while retaining each message's own subject type/name. This would be an investigation-context link, not proof that every subject is the same SAP object. Before enabling it, confirm the export contract with the transformation lead/tool owner and define failure behavior for missing terminals, sequence gaps, reordered/sorted logs, repeated blocks, or conflicting anchors. Unsupported blocks must remain visible for review. Never forward-fill blank identifiers silently.

## Comparing errors after identifying an object

A has explicit `Error Category` values. B `Objects.Status` is always `UPLD_ERROR`; B `Errors.Type` is a message-type/severity code. Neither provides comparable specific categories. The specific-looking B `Manually added status` column is human annotation and cannot supply automated ground truth without separation.

Later comparison should therefore:

- Retain the complete set/multiset of A categories and all associated B messages, including progress and summary rows, with original provenance.
- Use source-supported, versioned message patterns to *suggest* B categories. Validate those patterns before automatic acceptance. Unknown patterns remain unknown.
- Compare categories separately from evidence details. Two lock messages can refer to different transport requests; sharing `OBJ_LOCKED` does not prove a shared cause or identical finding.
- Keep repeat messages rather than deduplicating by object, message type or trimmed text before their semantics are established.
- Show different categories and missing comparable evidence explicitly. Do not interpret a phase-dependent message change as an automation failure.

No synonym dictionary, category extraction rule or inclusion rule has been coded during discovery.

## Evidence-backed examples

Only the three identifiers already included in the project reference are repeated here. Other examples use row locations to minimize copying customer data.

| Example | A evidence | B evidence | Supported interpretation |
|---|---|---|---|
| `ZRMMIMPORT_2` | `Detailed_LOG` row 300, `PROG`, `OBJ_LOCKED` | `Objects` row 2; `Errors` rows 2–4 | Same typed identity. Rows 2–3 mention the supplied transport identifier `LE1K9A7GHH`; row 4 is a block terminal. Lock-category comparison remains distinct from customer disposition. |
| `ZSLO_COND_SEND` | `Detailed_LOG` row 307, `PROG`, `NO_TLAYER` | `Objects` row 4; direct-name `Errors` rows 50, 51, 55, within block 50–55 | Row 51 explicitly references the missing layer `ZD87`. Rows 52–54 use other subjects and need the proposed context link. Object equality must not hide those messages. |
| `Z_CL_HUM` | No exact normalized-name match in A | `Objects` row 3; `Errors` rows 5–8 | Upload-only under the direct comparison. Messages include a transport lock and methods not modified. This is a review case, not a proven automation defect. |
| Transformation-only example | `Detailed_LOG` row 3, `PROG`, `NO_TRANS_ROUTE` | No matching B `Objects` name | Preserve the finding; expected upload scope is unknown. |
| Several A findings for one identity | `Detailed_LOG` rows 7–8 | Not a separate object per row | `NO_DEVC` and `NO_TRANS_ROUTE` are two findings on one typed identity. |
| Same B identity, different review text | `Objects` rows 172–173 and 179–180 | Corresponding C rows 120–121 and 127–128 | Keep both annotations and source rows; do not discard duplicate names. |

The lock and layer examples support future identifier extraction. No cross-object blocker group is asserted here; a later Radar implementation must verify an identifier across distinct affected objects and show its evidence.

## Manual fields and reference leakage

- B `Objects.F` and `.G` are explicitly manual. Store them as imported review annotations with their own origin, rather than generated category/action fields. Importing an existing annotation must not silently mark a new report approved.
- C `Error details.D:E` and `Recheck.B:C` are curated labels and comments. Keep C outside the ordinary two-input pipeline and outside automatic matching decisions.
- A `Suggested Action` is source text, not approved customer instruction. Preserve it independently from a reviewer-entered action.
- Reference `Status` mixes technical labels and business labels such as `Out of scope`. Do not conflate it with tool status, finding comparison status, reviewer disposition or approval.

Of C's 153 detail rows, 145 reproduce B's `(type, name, manual status, trimmed comment)` tuple. Eight were relabeled `Out of scope`: seven from manual `NO_TLAYER` and one from manual `NO_TRANS_ROUTE`. All eight remain in the reference report. All four recheck names also appear in details; two have different status/comment tuples. The user has since defined scope using shared-TR membership (BR-002); technical categories alone cannot establish that membership. Recheck rules remain unresolved.

## User clarification — out-of-scope reporting

On 2026-10-24, the user clarified that out-of-scope objects must be sent in the customer report for revalidation and a decision on access before the second run. BR-001 in [mapping-rules.md](mapping-rules.md) records this confirmed reporting purpose. An `Out of scope` label must not silently remove an entry from the reviewed customer-report workflow. Internal review approval and customer access permission remain distinct.

The user then defined an out-of-scope object as one absent from the TR shared with the transformation team, which currently cannot see or access that object in this workflow (BR-002). Customers usually add the object to that TR or provide another TR (BR-003). Report absence is not TR nonmembership: an upload-only or transformation-only object cannot be classified out of scope from that status alone. An authoritative TR inventory or reviewed membership evidence is still needed to apply the definition. The inventory format, label ownership, decision/response evidence, report placement and second-run behavior following denial/no response remain open. The eight sample labels have not been independently checked against TR membership.

## Discrepancies and newly established details

| Reference expectation | Actual discovery / consequence |
|---|---|
| Sources under `data/samples/` | Files are under `data/sample_files/`; left in place |
| `docs/PROJECT_REFERENCE.md` | Existing file is `docs/Project_Reference.md`; link with exact case for portability |
| Approximate row/name counts and 172-name overlap | All agree exactly with the supplied copies; overlap also holds for typed keys |
| Summary sheets appear unpopulated | Confirmed: zero populated cells, one pivot definition each, plus invalid pivot-dependency warnings |
| Upload error categories can be compared | Specific upload categories are not explicit in tool columns; the specific-looking column is manually added |
| Detailed upload linkage unspecified | 203 sequence blocks with terminal object anchors observed; 422 rows need more than a direct typed-key join |
| Reference report has error details and four rechecks | The four names overlap details. Eight detail rows are `Out of scope`; the user clarified their purpose as customer revalidation/access decisions before the second run. Other inclusion and recheck rules remain open. |
| Report resembles a generic finding table | Actual detail layout has five columns; recheck has three, with no object-type column |

No original reference text or source file was changed to conceal these differences.

## Questions that require the transformation lead or tool owner

1. Is block sequence/terminal-row structure a stable tool-export contract? Can logs be sorted, partial, concatenated or repeated? Which row identifies the parent investigation?
2. Which `PROG`/`FUNC`/`METH` subjects are components of which `FUGR`/`CLAS` objects? Is a documented SAP relationship available, rather than a naming guess?
3. Who assigns `Out of scope`, and which authoritative inventory/evidence confirms whether an object belongs to the shared TR? The definition is answered in BR-002 and its reporting purpose in BR-001. Rules selecting other customer entries and the meaning of an absent report entry remain open.
4. When and by whom were B's manual statuses/comments added? Why do some `UPLD_ERROR` objects have manual `Uploaded` labels? Are there later system checks behind them?
5. Are repeated object rows separate actions, alternative diagnoses or accidental duplicates? Which fields determine customer-action identity?
6. Does recheck mean additional detail-sheet membership, replacement membership, or a separate work queue? Which comment takes precedence?
7. What should happen to transformation-only, upload-only and unsupported-context messages? Which initial objects were actually intended for remediation/upload?
8. Is C validated ground truth or an example needing correction? Is it suitable for inclusion evaluation, given mixed labels and manual copying?
9. Which customer-facing fields, icons, summary layout, owners and approvals are required? Is an audit tab acceptable, or must provenance remain internal?
10. Are longer messages truncated upstream to 194 characters? Can a fuller log export be provided if necessary?
11. What local use, demonstrations and eventual AI services are approved? No external AI is required for the MVP.

Use [SENIOR_QUESTIONS.md](SENIOR_QUESTIONS.md) for the current priorities and questions at each build stage. Record future answers with dates, examples and testable rules in [mapping-rules.md](mapping-rules.md). Apply confirmed requirements while leaving unsupported dispositions and identity/context links for review.

## Completion and practical next step

Dataset discovery is complete: all seven sheets were inspected, schemas and feasibility documented, folders reserved, and local data exclusions expanded. The backend foundation was followed by evidence-preserving ingestion and synthetic fixtures, described in [backend/README.md](../backend/README.md). Original local ingestion counts agree with discovery. Matching, message-parent linking, customer exports and AI remain future work; none of the proposed reconciliation rules above have been automatically enabled.
