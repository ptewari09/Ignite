# Cross-dataset reconciliation findings

Version 0.2, 2026-10-28. Milestone 0.8A aggregate investigation with a 0.8C compatibility-status update. D1 denotes the original three-report bundle; D2 denotes the newly supplied bundle. These are file bundles, not verified independent projects/cycles. No customer object names, messages, comments or transport identifiers are reproduced.

**Compatibility update, 0.8C:** the historical failures in section 4 are now resolved by [explicit ingestion layouts](INGESTION_LAYOUTS.md). Read-only verification accepts all four source files with unchanged counts and bytes. The raw source's four absent fields remain null/sparse, and no reconciliation or sequence linking was added. The discovery observations and uncertainty classifications below remain valid.

## 1. New workbook roles and structures

Roles were established from worksheets and row-1 fields, not filenames alone.

| Supplied D2 workbook | Observed role and worksheets | Data rows |
|---|---|---:|
| `ZF_S01_Transformation_Check_Objects_Error_LOG.XLSX` | Transformation findings: empty `Summary`, populated `Detailed_Log` | 421 findings |
| `S01Upload errors.xlsx` | Post-upload evidence: identity list `Sheet1`, technical-message log `Sheet2` | 163 object rows; 865 messages |
| `ZF_S01_Upload_Errors.xlsx` | Customer/reference-shaped output: empty `Summary`, five-column `Error log`; no `Recheck` sheet | 159 entries |

The output-shaped workbook contains statuses/comments, but its authorship, approval and accuracy are not established. It remains a reference, not ordinary matching input or verified training labels.

Normalized row-1 headers:

- D2 `Detailed_Log`: `Status`, `Object Type`, `Object Name`, `Error Category`, `Message`, `Suggested Action`, `File Name` — the same seven fields as D1, with a different worksheet-name case.
- D2 `Sheet1`: `Status Inf`, `Object Typ`, `Object Name` — only three identity/display fields. Unlike D1 `Objects`, it has no `Status`, `Re Upload`, `Manually added status` or `Manually added comments`.
- D2 `Sheet2`: `Info`, `S.No`, `Object Typ`, `Object Name`, `Type`, `Message` — the same six logical message fields as D1 `Errors`.
- D2 `Error log`: `Status Inf`, `Object Typ`, `Object Name`, `Status`, `Comments` — the same five logical fields as D1 reference `Error details`, but a different tab name and no separate recheck list.

D2 object-name headers have trailing padding (raw width 30); its technical `Message` header has raw width 191 versus D1's 194. Existing header whitespace normalization handles these field-name differences. All inspected sheets are visible, with no source formulas, Excel error cells, merged ranges or data validations. Summary sheets contain no populated cells and do contain pivot metadata; they supply no usable counts. Library metadata warnings were observed during inspection and are distinct from schema failures.

## 2. Aggregate comparison

| Metric | D1 | D2 |
|---|---:|---:|
| Transformation findings | 361 | 421 |
| Transformation distinct names / typed keys | 309 / 309 | 385 / 386 |
| Transformation repeated typed-key groups / surplus rows | 52 / 52 | 35 / 35 |
| Upload-object rows / distinct typed keys | 205 / 203 | 163 / 148 |
| Upload repeated typed-key groups / surplus rows | 2 / 2 | 2 / 15 |
| Maximum upload rows sharing one key | 2 | 15 |
| Technical messages / distinct typed subject keys | 1,226 / 410 | 865 / 302 |
| Messages missing both subject name and type | 165 | 46 |
| Names with multiple types within technical messages | 31 | 31 |
| Shared transformation/upload names and typed keys | 172 / 172 | 134 / 134 |
| Transformation-only names / typed keys | 137 / 137 | 251 / 252 |
| Upload-only names / typed keys | 31 / 31 | 14 / 14 |
| Reference entries / distinct typed keys | 153 / 151 | 159 / 144 |
| Reference typed keys absent from upload-object list | 0 | 0 |
| Upload-list keys without a direct typed message | 0 | 1 |
| Reference `Out of scope` entries | 8 | 0 |
| Reference recheck entries | 4, supplied separately | Not supplied; no sheet |

These are normalized set/count comparisons, not executed reconciliation results, verified SAP matches or remediation metrics. D2 has one name with both `FUGR` and `PROG` transformation types; neither typed group appears in its upload-object list. Preserve two typed groups rather than collapsing them into one name. Top-level shared names otherwise have agreeing typed counterparts in both bundles.

Both bundles have no blank transformation/upload-list identities and no non-text/non-ASCII names. D2 has 161 padded upload names and 814 padded technical-message names; 815 technical names change under normalization, including a case difference. D1 names need no such changes, although type padding is common in both. No distinct raw identity variants collide within a normalized typed key in either bundle.

Internal spaces occur in 113 D1 and 160 D2 transformation name fields, in `PROG`, `FUNC` and `METH` rows; these names are already unchanged by the current normalization. None directly equals an upload-object key. They may encode components or compound subjects. Spaces must not be treated as proof of invalid data, deleted, or used to infer a parent. Preserve them and require format/identity review.

### Categories and annotations

| Transformation category | D1 rows | D2 rows |
|---|---:|---:|
| `OBJ_LOCKED` | 189 | 158 |
| `NO_TLAYER` | 19 | 167 |
| `EDITOR_LOCK` | 62 | 49 |
| `SAP_OB` | 76 | 44 |
| `NO_DEVC` | 2 | 3 |
| `NO_TRANS_ROUTE` | 13 | 0 |

D1 repeated findings pair `SAP_OB`/`EDITOR_LOCK` 50 times and `NO_DEVC`/`NO_TRANS_ROUTE` twice. D2 has 30 `SAP_OB`/`EDITOR_LOCK`, three `NO_DEVC`/`NO_TLAYER` and two `SAP_OB`/`OBJ_LOCKED` groups. A category's co-occurring category is not a fixed mapping or a diagnosis of the upload evidence.

D1 supplies `UPLD_ERROR` on all 205 object rows and manual annotations on all of them, including 49 `Uploaded` labels. D2 supplies neither broad tool-status nor manual-status/comment columns. Missing columns mean **not supplied**, not successful, resolved, in scope, unreviewed text invented by the app, or automatically `UPLD_ERROR`.

D2 reference statuses are `OBJ_LOCKED` 129, `EDITOR_LOCK` 19, `NO_TLAYER` 8 and `NO_DEVC` 3. Its zero out-of-scope labels do not prove that every object is in the shared TR. Both references repeat two typed identities with differing comments. In D2, the raw upload list also has physically identical repeated rows; preserve all rows even when their meaning is unknown. Neither source contains authoritative shared-TR membership evidence.

### Message attribution and ordering

| Technical-message partition | D1 rows | D2 rows |
|---|---:|---:|
| Exact typed key found in upload-object list | 804 | 526 |
| Same listed name, different type | 33 | 5 |
| Named subject absent from upload-object list | 224 | 288 |
| Blank subject identity | 165 | 46 |
| **Total** | **1,226** | **865** |

Message types are `E/W/I/S/blank` in both. Blank-severity rows number 203/170 respectively; severity and presence in a log do not establish error category or customer action. Raw message width is uniformly 194 characters in D1 and 191 in D2. This confirms width variation, not whether longer upstream text was truncated.

D1 has 203 reset-at-1, consecutive sequence ranges whose terminal keys uniquely cover its 203 upload keys without direct-anchor conflicts. D2 instead has 865 distinct, strictly increasing sequence values spanning 1–1,164, with 299 unrepresented integers and only one value 1. The reason for the gaps is unknown; do not claim that 299 messages were deleted. Treating D2 as one reset-based block would conflict with 523 of its directly identified rows.

An alternative blank-severity terminal scan yields 170 D2 ranges: 147 end in listed typed keys without direct-key conflicts, 23 end in unlisted keys, and one of the 148 listed keys has no such terminal. This is another observed layout, not a validated parent contract or a safe replacement algorithm. Terminal rows do not universally cover `Objects` keys, and terminal counts do not reproduce the physical duplicate object rows in either bundle. Direct subject links remain usable; unsupported context stays potential/unattributed.

Body-name scans find known listed-name mentions in two non-direct messages per bundle. They support investigating exact-token candidate references, not promoting a body mention to confirmed subject/parent identity.

Potential component context remains structural: D1 candidate ranges place 13 non-direct `METH` rows under `CLAS` terminals and nine `FUNC` rows under `FUGR`; D2's alternative listed-terminal ranges place nine `FUNC` rows and 22 non-direct `PROG` rows under `FUGR`. These are unconfirmed co-location counts, not verified parent-child mappings. Compound transformation fields require their own format explanation; no prefix stripping or type alias is justified.

One D2 listed typed key has no directly matching technical message and is nevertheless present in the reference. This does not establish that no indirect evidence exists, but disproves universal explicit-message coverage. Preserve the object and its uncertainty; a reference comment cannot manufacture missing source attribution or become a verified pair label.

## 3. Assessment of the proposed rules

Classification meanings: **Both** = supported by observations in both bundles within the stated scope; **One** = observed in just one bundle; **Contradicted** = an asserted generalization has a concrete counterexample; **Insufficient** = neither semantic truth nor the required case is established. Support is not SAP approval, precision/recall, or a reason to remove safety guards. Normative controls are retained even where files cannot test their correctness.

| Rule or design claim | Classification | Evidence and refinement |
|---|---|---|
| L-01 explicit, uniquely header-validated layout profiles | Both | Different table names/shapes are observed; compatibility now selects one known layout and validates its headers, rejecting ambiguous complete pairs |
| L-02 retain supplied/absent field metadata | Both | D1 supplies four status/manual fields that D2 omits; absence cannot be enriched from the reference |
| O-01 exact normalized type/name grouping; preserve duplicates | Both | 172/134 shared typed keys; duplicate object/finding rows in both. Technical equality only |
| O-02 top-level name-only match with missing type | Insufficient | No missing top-level types in either bundle; retain synthetic cases and review fallback |
| O-03 retain incompatible/competing typed identities | Both | 31 multi-type technical names in each; D2 also has one multi-type transformation name. Actual top-level conflict/candidate variants still need synthetic coverage |
| O-04 transformation-only presence | Both | 137/251 names absent from upload lists; typed D2 total is 252. Absence does not prove a missed change |
| O-05 upload-only presence | Both | 31/14 names absent from transformation. No automatic defect/scope conclusion |
| O-06 separate unnamed top-level cases | Insufficient | No unnamed T/U-list rows here; missing message identities support A-05, not a claim that O-06 was exercised |
| O-07 no inferred parent/fuzzy equivalence | Both | Different typed subjects, namespaces and compound transformation fields occur in both; no verified parent map supplied |
| A-01 explicit structured object type/name link | Both | 804/526 direct message rows; links target groups, not a selected duplicate row |
| A-02 potential missing/conflicting-type link | Both | 33/5 same-name incompatible-type messages; missing-type-with-known-name subcase remains unobserved |
| A-03 body-reference candidates requiring review | Both | Two non-direct messages per bundle mention a listed name; parent/diagnosis roles remain unverified |
| A-04 reset-based context hypothesis | One | D1 layout only; retain as an unapproved profile-specific hypothesis, not a shared parser or default rule |
| A-05 preserve unattributed messages | Both | 422/339 messages lack direct listed typed-key attribution |
| Normalize outer padding/case while preserving raw values | Both | Padded types in both, padded names/case difference in D2; no observed collision is a universal safety guarantee |
| Internal-space handling | Both | 113/160 compound-looking source fields require preservation/review; declaring all internal spaces corrupt would be contradicted by both source shapes |
| Non-text and non-ASCII collision guards | Insufficient | Neither phenomenon appears here; keep conservative synthetic tests |
| Preserve namespaces/separators; do not create type aliases | Both | Such naming conventions are present; neither bundle validates parent extraction or aliases |
| Unknown-type expansion policy | Insufficient | No new type token beyond the previously observed vocabulary; arbitrary future types remain review cases |
| Lock/layer positive-pattern investigations | Both, as lexical leads only | Relevant text occurs in both; no verified pair labels or approved production predicate establishes semantic equivalence |
| `EDITOR_LOCK`, `NO_DEVC`, `SAP_OB` semantic mappings | Insufficient | Co-occurring categories and shared editor/package words admit competing interpretations |
| `NO_TRANS_ROUTE` semantic mapping | Insufficient | Category occurs only in D1; no D2 validation; layer wording is not route equivalence |
| Strong/possible/different-error correspondence outcomes | Insufficient as verified semantic outcomes | They remain proposed output contracts; no human-verified cross-report error pairs were supplied |
| `NO_CORRESPONDENCE_IDENTIFIED` / `UPLOAD_ONLY_ERROR` semantic outcomes | Insufficient | One-sided records motivate these contracts, but verified error-pair/negative labels and diagnostic interpretation are absent; no-pair must not mean resolved |
| `INSUFFICIENT_EVIDENCE` fallback | Both | Unattributed subjects and unresolved category/context semantics occur in both; preserve evidence rather than force a pair |
| Preserve manual annotations; `Uploaded` is not resolution proof | One for supplied annotations | D1 source fields/labels only. In D2 absence of those fields must remain explicit; neither file proves resolution |
| Retain reviewed out-of-scope customer requests | One for observed labels | D1 reference has 8, D2 has 0; BR-001–BR-003 remain user-confirmed requirements, not inferred label rules |
| Immutable runs, separate review/approval/access, audit and isolation | Insufficient for empirical execution validation | Required architecture/business safeguards; no implemented reconciliation or human-pair audit exists to test them on these files |
| S0–S6 stage contracts and proposed API/transaction/review behavior | Insufficient for empirical execution validation | Source files motivate complete evidence/uncertainty handling, but cannot execute or validate an unimplemented pipeline; retain contracts and add per-profile metadata |
| Every upload layout has D1 tabs and all seven object columns | Contradicted | D2 uses different tabs and lacks four columns; the historical D1-only contract has now been extended explicitly |
| `S.No` always restarts at 1 per object / is an object join key | Contradicted | D2 ordinals are unique/increasing with gaps; no global object key can be inferred |
| Blank-severity terminal keys always equal the upload list | Contradicted | D2 has 23 unlisted terminals and one listed key without a terminal |
| Every listed/reference object has a direct typed technical message | Contradicted | D2 has one listed key without such a message, also present in its reference |
| One object/finding row per key or a fixed category pairing | Contradicted | D2 has up to 15 upload rows per key and different repeated-category combinations |

The four design documents retain conservative fallbacks. The contradictions invalidate universal shortcuts, not their existing requirement to keep uncertain context disabled pending validation. No SAP category mapping is automatically approved.

## 4. Ingestion compatibility observed before the compatibility update

Unmodified production parser calls were made directly on bytes, with explicit test settings and no database/session/API calls:

| Input/check | Actual result |
|---|---|
| D1 transformation and upload workbooks | Accepted: 361 / 205 / 1,226 rows |
| D2 transformation workbook | HTTP-equivalent 422 `MISSING_WORKSHEETS`: `Required worksheets are missing: Detailed_LOG.` |
| D2 upload workbook | HTTP-equivalent 422 `MISSING_WORKSHEETS`: `Required worksheets are missing: Objects, Errors.` |
| Existing transformation row adapter called on actual D2 `Detailed_Log` | Accepted all 421 rows; required fields are compatible |
| Existing upload-message row adapter called on actual D2 `Sheet2` | Accepted all 865 rows, integer sequences preserved |
| Existing upload-object adapter called on actual D2 `Sheet1` | `MISSING_COLUMNS`: requires `Status`, `Re Upload`, `Manually added status`, `Manually added comments` |
| D2 customer/reference workbook | No ordinary reference-import role exists; its different tab and absent recheck section concern later reference/export compatibility |

Calling row adapters explicitly was an inspection probe, not a workaround added to the app. No workbook was renamed, edited or imported. Renaming tabs alone would not make the raw upload workbook compatible.

Recommended future compatibility work: explicit header-validated layout profiles, unique profile selection, narrowly approved sheet aliases, and nullable/not-supplied handling for absent optional source fields. Never fabricate tool statuses, copy reference labels into source records, or require the customer reference as normal input. Capture profile/field-availability metadata for later reconciliation. This is proposed separate work; parsers, schemas and migrations remain unchanged here.

## 5. ML readiness and leakage

Potential features are typed object identity, category labels, message text, explicitly captured references, observed source context and subsequently human-confirmed relationships. Manual annotations and reference statuses can be annotation aids, not automatic pair labels or predictor inputs. No reliable human-verified matched/unmatched object/attribution/error-pair set has been established from these files. Curated-looking output rows establish neither complete positives nor negatives for missing rows.

The bundles share 28 transformation typed keys, 12 upload-list keys and 28 technical-message typed keys. They also share 43 distinct trimmed transformation texts and 63 distinct trimmed technical texts. A row-random split would leak repeated objects/templates. Two bundles of unverified project/cycle independence cannot supply a defensible independent training/validation/test allocation.

Before any modeling, obtain authorized human labels, verified project/cycle group IDs and more independent groups. Separate object identity, attribution and error-correspondence targets; retain an uncertain/abstain label. Split whole groups before fitting anything, then audit duplicate objects/text/templates across boundaries. Tune only on validation groups and evaluate once on untouched test groups against the deterministic baseline, reporting precision/recall, coverage and review burden separately. See the [architecture's ML evaluation plan](RECONCILIATION_ARCHITECTURE.md#10-future-ml-evaluation-plan).

No model was trained, downloaded or integrated; no external AI API was used.

## 6. Next step and validation boundary

The separately authorized report-layout compatibility work is complete for both bundles; see [INGESTION_LAYOUTS.md](INGESTION_LAYOUTS.md) for the implemented contract and verified counts. The next proposed step is **0.9A pure object matching and synthetic tests**. Message-block inference and semantic mappings remain later, separately gated work. The final protection paragraph below records the discovery milestone's boundary; the compatibility task changes only its documented ingestion/guidance/test scope.

The six original workbook hashes were unchanged before/after inspection. Existing project files were snapshotted for integrity checking. Only the four design documents and this new findings document are in scope; no application/test code, database, schema, migration, dependency or running service is changed. No confidential workbook or raw record is added to Git, and no commit/push is performed. Counts and parser probes are discovery evidence, not executed engine acceptance tests or measured ML accuracy.
