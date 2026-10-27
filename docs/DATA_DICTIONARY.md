# TraceSync data dictionary

Inspected locally on **2026-10-24**, using Python 3.12.4 and OpenPyXL 3.1.2. This records the supplied files, rather than assumed schemas. Workbook roles A/B/C follow [Project_Reference.md](Project_Reference.md). The originals remain in `data/sample_files/`.

## Counting and privacy conventions

A data row is a row after the row-1 header containing at least one nonblank cell. `None`, empty strings and whitespace-only strings count as missing. Formatting, row heights and pivot definitions do not count as records. Excel row numbers include the header. Counts of repeated identifiers use whitespace-normalized, uppercase names; punctuation and component delimiters are preserved. No object names needed changing in these samples, although many type codes require trimming.

All nonmissing table cells are text except `Errors!B` (`S.No`), which contains integers. Missing counts below are out of the sheet's data-row count. Examples containing angle brackets are synthetic descriptions, not copied customer text. Technical category labels and icon tokens are shown as observed. Object names, transport identifiers, users and full messages are deliberately omitted from this dictionary.

The inspector produces a local, ignored `data/outputs/workbook_profile.json` with exact raw header strings, all duplicate-name row groups and five pseudonymized sample records per populated sheet. Its aliases are for inspection only and are not canonical object identifiers.

## Workbook inventory

| Role / workbook | Sheet, in actual order | Populated data rows | Distinct nonblank names | Repeated-name groups | Worksheet dimension |
|---|---|---:|---:|---:|---|
| A: `Zf_LE1_Transformation_Check_Objects_Error_LOG.XLSX` | `Summary` | 0 | n/a | n/a | `A1:A1` |
| A | `Detailed_LOG` | 361 | 309 | 52 | `A1:G362` |
| B: `Upload errors.xlsx` | `Objects` | 205 | 203 | 2 | `A1:G206` |
| B | `Errors` | 1,226 | 378 | 246 | `A1:F1227` |
| C: `ZF_LE1_Upload_Errors.xlsx` | `Summary` | 0 | n/a | n/a | `A1:B140` |
| C | `Error details` | 153 | 151 | 2 | `A1:E154` |
| C | `Recheck` | 4 | 4 | 0 | `A1:C5` |

Repeated names mean several records refer to a name; they do not imply accidental duplicate rows. There are **zero completely identical data rows** in all five populated sheets. No blank rows interrupt their data ranges.

## A — initial transformation evidence

### `Summary`

No populated cells, headers or data records. There is one pivot-table definition and column formatting. OpenPyXL warns that `xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels` contains invalid dependency definitions when opening A. The detailed sheet remains readable. Do not treat an empty summary as zero findings, require pivot refresh, or use pivot caches as authoritative records.

### `Detailed_LOG`

Header row 1, data rows **2–362**. Each row is a transformation finding; one object can have several findings.

| Position | Exact header | Type | Missing | Proposed canonical field / meaning | Non-sensitive example |
|---|---|---|---:|---|---|
| A / 1 | `Status` | text | 0 | `source_status_icon_raw`; display token, not customer disposition | `@0A@` |
| B / 2 | `Object Type` | text | 0 | `object_type_raw`; source object-kind code | `PROG` |
| C / 3 | `Object Name` | text | 0 | `object_name_raw`; name to pair with type | `<program identifier>` |
| D / 4 | `Error Category` | text | 0 | `error_category_raw`; explicit transformation category | `OBJ_LOCKED` |
| E / 5 | `Message` | text | 0 | `error_message_raw`; original technical evidence | `<object lock message>` |
| F / 6 | `Suggested Action` | text | 75 | `suggested_action_raw`; source suggestion, subject to review | `<source investigation suggestion>` |
| G / 7 | `File Name` | no populated values | 361 | `file_name_raw`; entirely empty, unusable as linkage key | empty |

The source filename for provenance must come from the imported file, not column G. All 361 status tokens are `@0A@`; their business meaning is unconfirmed. Message lengths range from 26 to 62 characters. There are 286 populated suggested actions with four distinct texts; retaining them does not constitute approval.

| Transformation error category | Finding rows |
|---|---:|
| `OBJ_LOCKED` | 189 |
| `SAP_OB` | 76 |
| `EDITOR_LOCK` | 62 |
| `NO_TLAYER` | 19 |
| `NO_TRANS_ROUTE` | 13 |
| `NO_DEVC` | 2 |
| **Total** | **361** |

Object-type row frequencies: `PROG` 170, `FUGR` 139, `METH` 22, `FUNC` 19, `CLAS` 11. The 309 names also give 309 distinct `(type, name)` keys; no name has conflicting types within this sheet. Of these, 257 occur once and 52 occur twice. The two records in each repeated group have different categories: 50 groups pair `SAP_OB` with `EDITOR_LOCK`, and two pair `NO_DEVC` with `NO_TRANS_ROUTE`. For example, rows 7–8 represent one typed object with two distinct findings. Do not discard either row.

## B — post-upload objects and technical messages

### `Objects`

Header row 1, data rows **2–206**. These are object-level upload records enriched with explicitly manual review fields.

| Position | Exact header | Type | Missing | Proposed canonical field / meaning | Non-sensitive example |
|---|---|---|---:|---|---|
| A / 1 | `Status Inf` | text | 1 | `source_status_icon_raw`; display token | `@0A\Q@` after trimming |
| B / 2 | `Object Typ` | text | 0 | `object_type_raw`; trim right padding for comparisons | `CLAS` after trimming |
| C / 3 | `Object Name` | text | 0 | `object_name_raw`; object-level name | `<class identifier>` |
| D / 4 | `Status    ` (four trailing spaces) | text | 0 | `upload_status_raw`; broad tool outcome | `UPLD_ERROR` |
| E / 5 | `Re Upload` | text | 0 | `re_upload_icon_raw`; preserve token, behavior unconfirmed | `@4R@` after trimming |
| F / 6 | `Manually added status` | text | 0 | `imported_review_status_raw`; manual annotation | `Uploaded` |
| G / 7 | `Manually added comments` | text | 0 | `imported_review_comment_raw`; manual narrative | `<reviewer comment>` |

All 205 D values are `UPLD_ERROR`, while 49 manual F values are `Uploaded`. These record different dimensions and possibly different times; do not overwrite either or infer chronology. All 205 type values and re-upload icon values are padded; 204 status icons are padded. The missing icon is **A172**, not a missing object.

| Manual status in F — annotations only | Rows |
|---|---:|
| `OBJ_LOCKED` | 121 |
| `Uploaded` | 49 |
| `NO_TRANS_ROUTE` | 11 |
| `EDITOR_LOCK` | 10 |
| `NO_TLAYER` | 10 |
| `Check in system` | 1 |
| `Manual Upload` | 1 |
| `Manual check` | 1 |
| `SPAU_ERROR` | 1 |
| **Total** | **205** |

There is no automatically generated, specific error-category field in this sheet. F must not fill that role in matching evaluation. G may quote technical messages but remains manual evidence of review, rather than a replacement for `Errors`.

Object-type row frequencies: `PROG` 104, `FUGR` 71, `CLAS` 30. There are 203 names and 203 typed keys. The repeated typed keys occupy rows **172–173** and **179–180**. Their comments differ; the first pair also differs in status-icon presence. Do not merge their decisions without a validated rule.

### `Errors`

Header row 1, data rows **2–1227**. Each row is a technical log record, including diagnostic messages, progress messages and apparent block summaries. It is not a list of 1,226 independent customer actions.

| Position | Exact header | Type | Missing | Proposed canonical field / meaning | Non-sensitive example |
|---|---|---|---:|---|---|
| A / 1 | `Info  ` (two trailing spaces) | text | 0 | `message_icon_raw`; preserve independently from severity | `@5C\Q@` |
| B / 2 | `S.No` | integer | 0 | `message_sequence_raw`; block-local ordinal | `1` |
| C / 3 | `Object Typ` | text | 165 | `object_type_raw`; named message subject, sometimes a component | `METH` after trimming |
| D / 4 | `Object Name` | text | 165 | `object_name_raw`; named message subject, may be empty | `<component identifier>` |
| E / 5 | `Type` | text | 203 | `message_type_raw`; observed severity/type code, not object type or error category | `E` after trimming |
| F / 6 | `Message` + 187 trailing spaces (194 characters total) | text | 0 | `error_message_raw`; preserve original text | `<transport-layer diagnostic>` |

All 165 missing C values are whitespace-only strings; the corresponding D values are empty cells. All 203 missing E values are whitespace-only. **Every** C and E cell needs whitespace normalization, including missing values. All 1,226 messages are exactly 194 characters in raw form, and 1,224 change under trimming. Preserve raw values and use separate normalized values for comparisons. Determine whether the upstream export truncates longer messages before claiming complete message fidelity.

| `Type`, after trimming | Rows |
|---|---:|
| `E` | 488 |
| `I` | 309 |
| `W` | 185 |
| `S` | 41 |
| blank | 203 |
| **Total** | **1,226** |

These are message-type frequencies. An `OBJ_LOCKED`/`NO_TLAYER` category frequency cannot be obtained from an explicit tool-generated category column in B. It would require validated message interpretation, implemented later.

Icon counts: `@5C\Q@` 488, `@0S\Q@` 309, `@5D\Q@` 185, `@5B\Q@` 41, `@77\Q@` 203. The last token occurs on the blank-severity terminal rows. Do not assume all icon tokens signify failure.

Among 1,061 named message rows there are 378 normalized names and **410 typed keys**. Thirty-one names occur with multiple types; a name-only join loses information. Typed row frequencies are `PROG` 489, `FUGR` 417, `CLAS` 132, `METH` 13, `FUNC` 9 and `INCL` 1. There are 246 repeated-name groups, reaching 13 rows per name; retain each message's provenance.

`S.No` ranges from 1 to 55, with only 55 distinct values. It restarts at 1 in **203 contiguous blocks**. Each block has consecutive sequence numbers and ends with a blank-severity, `@77\Q@` record whose typed name belongs to `Objects`. The 203 terminal keys exactly cover the 203 distinct object keys. Blocks contain between 2 and 55 records; the first is rows 2–4, the second 5–8, and a function-group example is rows 18–28. `S.No` alone, or even `(S.No, type, name)`, is not globally unique. These are observed structural associations, pending validation of their meaning.

## C — manually curated customer reference

Use C as a format and review-decision benchmark, subject to lead confirmation. Its status/comments must not enter ordinary source matching or become inferred approval rules.

### `Summary`

Zero populated cells or headers within `A1:B140`, but 252 styled cells and one pivot-table definition. C emits the same invalid-pivot-dependency warning as A. The visible cell grid provides no summary results. The future exporter must agree a summary format rather than promise to reproduce a working pivot automatically.

### `Error details`

Header row 1, data rows **2–154**. These are curated output entries.

| Position | Exact header | Type | Missing | Proposed reference/export mapping | Non-sensitive example |
|---|---|---|---:|---|---|
| A / 1 | `Status Inf` | text | 1 | Source display token, if required in final format; not approval | `@0A\Q@` after trimming |
| B / 2 | `Object Typ` | text | 0 | Reviewed object's type | `PROG` after trimming |
| C / 3 | `Object Name` | text | 0 | Reviewed object's name | `<program identifier>` |
| D / 4 | `Status` | text | 0 | Reviewer-approved category or disposition label | `Out of scope` |
| E / 5 | `Comments` | text | 0 | Reviewed customer description/action; mapping still to confirm | `<customer-facing comment>` |

All 153 type strings are padded. The missing icon is **A120**. Rows **120–121** and **127–128** repeat typed identities with differing comments, corresponding to the two repeated identities in B. The 151 names and typed keys all appear in B `Objects`. Type frequencies are `PROG` 99, `CLAS` 28 and `FUGR` 26.

| Curated `Status` | Rows |
|---|---:|
| `OBJ_LOCKED` | 121 |
| `EDITOR_LOCK` | 10 |
| `NO_TRANS_ROUTE` | 10 |
| `Out of scope` | 8 |
| `NO_TLAYER` | 3 |
| `SPAU_ERROR` | 1 |
| **Total** | **153** |

In 145 rows the `(type, name, status, trimmed comment)` tuple matches B's manual annotations. The remaining eight are labeled `Out of scope` here: seven had B's manual `NO_TLAYER` label, one `NO_TRANS_ROUTE`. Those category-to-label transitions are observations, not automatic classification rules. The user clarified on 2026-10-24 that out-of-scope objects must be reported for customer revalidation and an access decision before the second run (BR-001), and defined them as objects absent from the TR shared with the transformation team, currently unavailable for the team's visibility/access in this workflow (BR-002); see [mapping-rules.md](mapping-rules.md). Report inclusion does not establish that access is granted. An authoritative TR inventory has not been established from the supplied workbooks, so these eight labels have not been independently verified against membership. The 52 B names absent from C cannot be classified as resolved, excluded or absent from the shared TR automatically.

### `Recheck`

Header row 1, data rows **2–5**. A separate curated list, with a different layout from `Error details`.

| Position | Exact header | Type | Missing | Proposed reference/export mapping | Non-sensitive example |
|---|---|---|---:|---|---|
| A / 1 | `Object Name` | text | 0 | Reviewer-marked name; type absent | `<object identifier>` |
| B / 2 | `Status` | text | 0 | Reviewed recheck category | `EDITOR_LOCK` |
| C / 3 | `Comments` | text | 0 | Separate recheck narrative | `<verification request>` |

Four distinct names, all present in B and C `Error details`. Categories `OBJ_LOCKED`, `EDITOR_LOCK`, `NO_TLAYER` and `SPAU_ERROR` occur once each. Only two of four `(name, status, trimmed comment)` combinations exactly match an `Error details` entry; preserve the separate recheck comments. Do not add four to 151 and claim 155 unique reference objects. Confirm whether future recheck entries should also appear in `Error details`.

## Cross-sheet relationships and future storage

| Relationship | Observed evidence | Implementation implication |
|---|---|---|
| A detailed findings → A object | 361 rows / 309 typed keys | One object can retain multiple findings |
| A object ↔ B object | 172 common names, also 172 identical typed keys | Prefer normalized `(type, name)`; retain 137 A-only and 31 B-only cases |
| B messages → B objects | 804 direct typed-key message rows; another 422 need context or review | Preserve message subject separately from any parent-object association |
| B blocks → B objects | 203 terminal typed keys cover all B object keys | Promising block-context linkage; requires business confirmation and defensive checks |
| C `Error details` → B `Objects` | All 151 reference names / typed keys present | Reference comparison is possible without including C in normal ingestion |
| C `Recheck` → other lists | All four names in B and C details; no type field | Retain recheck membership and separate narrative |

Future raw records need source-file identity, role, sheet, Excel row, raw payload and normalized comparison fields. Manual annotations, proposed findings, reviewed edits and approval state need separate fields/tables. Neither a generated object key nor a reviewer edit should replace the original row.

## Formatting and processing implications

- All seven sheets are visible. No merged ranges, formulas, Excel error cells, hidden rows/columns, Excel structured tables, cell comments, hyperlinks, data validations or conditional formatting were found. Future files still need validation for these cases. The columns named comments contain ordinary cell text, not Excel comment objects.
- Row 1 is the header for each populated sheet. Retain raw headers; use a trimmed-header map to handle `Status`, `Info` and the heavily padded `Message` header. Do not normalize all columns to the same semantic `status`: their meanings differ by sheet.
- A `Detailed_LOG` and C's populated tabs have styled headers. B has no styled headers. Colors/styles are presentation only, with no validated business meaning.
- Only C `Error details` has an autofilter (`$A$1:$E$154`). No sheet has frozen panes. Its name/status/comment column widths are 35 / 19.29 / 179.71; `Recheck` uses 22.29 / 15 / 52.29. No populated tab wraps text. A future export should retain logical columns and improve readability after agreement.
- C `Error details` contains 980 custom-height row-dimension entries, including formatting outside its 153 records. Counting row dimensions or styled cells would inflate record counts.
- No cached-formula question arises in these files because there are no worksheet formulas. A normal workbook load does not calculate or refresh pivot tables. Future importers must detect formula-bearing fields and avoid assuming cached results are current.

See [RECONCILIATION_DISCOVERY.md](RECONCILIATION_DISCOVERY.md) for proposed matching behavior and unresolved questions. The discovery observations above are preserved. The ingestion implementation subsequently adds the three source adapters; message-linking rules and reconciliation remain unimplemented.

## Implemented ingestion mapping

The verified A/B source fields now have explicit nullable raw columns in `transformation_findings`, `upload_objects` and `upload_errors`, plus separate normalized type/name columns. Every record retains workbook ID, worksheet, original Excel row and a JSON `raw_payload` whose keys preserve original headers. Manual status/comments are separate columns from tool status and are not copied into categories or approval fields. Missing/whitespace identities remain null only in normalized keys; raw whitespace is retained.

All documented headers for each supplied layout are required, including the annotated `Objects` manual fields. Header whitespace may vary; missing semantic fields or duplicate normalized headers cause a clear import error. Additional labeled columns are preserved. Unknown date/time extra values use tagged ISO JSON representations. Formula/error cells are rejected rather than trusting cached results. Summary tabs are not required or parsed. No parser creates parent links or infers the meaning of `S.No` blocks.

Verification against the originals stored 361 / 205 / 1,226 rows and compared every raw payload and physical row number; repeated identifiers and separate manual fields were preserved. All three file hashes remained unchanged. The customer reference was checked for unchanged bytes only and was not an ingestion input. See [backend/README.md](../backend/README.md) for endpoints, validation policy and portable synthetic verification.
