# Supported Excel ingestion layouts

Implemented compatibility contract, 2026-10-28. The existing workbook upload/list APIs and source evidence schemas are unchanged. No database migration, additional dependency or reconciliation is required.

## Accepted layouts

| Role | Exact worksheet layout | Required row-1 headers |
|---|---|---|
| `transformation` | Exactly one `Detailed_LOG` or `Detailed_Log` | `Status`, `Object Type`, `Object Name`, `Error Category`, `Message`, `Suggested Action`, `File Name` |
| `post_upload`, named layout | `Objects` **and** `Errors` | `Objects`: `Status Inf`, `Object Typ`, `Object Name`, `Status`, `Re Upload`, `Manually added status`, `Manually added comments`; `Errors`: `Info`, `S.No`, `Object Typ`, `Object Name`, `Type`, `Message` |
| `post_upload`, raw layout | `Sheet1` **and** `Sheet2` | `Sheet1`: `Status Inf`, `Object Typ`, `Object Name`; `Sheet2`: the same six technical-message headers as `Errors` |

In the raw `Sheet1` layout, `Status`, `Re Upload`, `Manually added status` and `Manually added comments` are optional. Any of these columns that are supplied are validated and preserved. The named `Objects` layout retains its original seven-column requirement, including empty manual fields. An unlabelled or unknown worksheet is not substituted for a supported tab merely because its contents look similar.

Selection first requires a recognized complete worksheet-name layout, then the corresponding adapters validate all required headers and source cells. A `Sheet1`/`Sheet2` pair with unrelated or missing headers is rejected, not guessed. Header whitespace is normalized; header case and semantic names are not guessed. The transformation aliases are the two exact spellings listed above, not arbitrary case variants.

If both complete post-upload pairs are present, ingestion rejects `AMBIGUOUS_LAYOUT` before choosing or discarding either source, even if one pair would later fail header validation. A mixed/incomplete pair is rejected as `MISSING_WORKSHEETS`. Additional unrelated sheets remain outside the selected source contract; `Summary` remains optional and ignored. Unknown layouts, duplicate normalized headers, formulas/error cells and populated unlabelled columns retain their validation errors.

## Missing columns versus empty cells

The four status/annotation model and API fields already allow nulls. For an absent optional raw-layout column:

- Its typed API/database value is null; no tool status, comment or business decision is fabricated.
- Its key is **absent** from `raw_payload`.
- A `MISSING_OPTIONAL_COLUMNS` warning lists the absent canonical headers. Its occurrence count is the number of missing columns, not rows.

For a present header with an empty cell, the typed value is null and the **original header key is present** in `raw_payload` with a null value. Original padded header spellings, raw text and additional labelled columns are retained. This distinction works with existing evidence APIs and raw-payload inspection; no new response field/entity was introduced.

Original worksheet names and physical Excel rows are never renamed to canonical names. `sheets_found`, `row_counts` and `object_counts` expose actual source sheet names. Repeated objects/findings/messages retain separate source records. Integer/blank sequence values are preserved, including gaps; no sequence-based linking or parent inference occurs.

## Existing operational guarantees

Byte-identical uploads within a cycle/role remain idempotent (200 and original metadata); new imports return 201. Different bytes for an occupied role remain 409, including a differently laid-out report. Parse/persistence failures roll back all new workbook/evidence rows. Upload limits, safe error envelopes/request IDs, provenance, pagination, manual/tool separation and unsupported-cell protections remain in force. Customer/reference reports are not source inputs.

The Upload Reports page explains both layouts and ambiguity errors through its existing controls. Projects and Evidence Explorer behavior are unchanged. Normal data is not a test target: retain [test isolation](TEST_DATA_ISOLATION.md), pytest temporary databases, browser API 8001/UI 5174 and owned disposable database cleanup.

## Verified source compatibility

Real source files were parsed locally without ingestion or modification. Counts match [cross-dataset discovery](CROSS_DATASET_FINDINGS.md):

| Dataset | Transformation rows | Object rows | Message rows |
|---|---:|---:|---:|
| D1 | `Detailed_LOG`: 361 | `Objects`: 205 | `Errors`: 1,226 |
| D2 | `Detailed_Log`: 421 | `Sheet1`: 163 | `Sheet2`: 865 |

All 163 D2 object records retain null values for the four absent fields and sparse three-column original payloads. The two customer/reference workbooks are not parsed as source inputs. Aggregate row counts establish ingestion coverage, not matching accuracy, error equivalence or customer approval.

Synthetic unit/API/browser tests cover both layouts, required/optional headers, null/sparse payloads, raw provenance, repeats, ambiguity, invalid cells/sequences, pagination, duplicates, occupied roles and rollback. Verification results: **103 backend tests passed, one confidential-data test intentionally skipped; 97 frontend tests passed; 20 real-browser tests passed; ESLint, TypeScript and production build passed.** The browser run stopped its owned servers and discarded its temporary database. The expanded guide was visually inspected at 320px. The existing upstream TestClient warning remains without failures.

### Demo Portability Check

No dependency or lockfile change, new database entity/migration, machine-specific source path or runtime internet requirement was added. The existing fresh-copy/offline backend regression remains passing. Both layouts work from the existing Windows setup commands and migrated SQLite schema; test workbooks are generated from synthetic source, not copied from customer files. A second physical laptop was not exercised.

### Implementation files

Backend source:

```text
backend/app/services/importers/layouts.py (new)
backend/app/services/importers/workbook.py
backend/app/services/importers/upload_objects.py
backend/app/services/importers/upload_errors.py
```

Frontend source (requirements and error copy only):

```text
frontend/src/components/uploads/uploadRequirements.ts
frontend/src/components/uploads/WorkbookUploadCard.tsx
frontend/src/services/workbookApi.ts
```

Synthetic tests:

```text
backend/tests/fixtures/workbooks.py
backend/tests/unit/test_workbook_layouts.py (new)
backend/tests/integration/test_layout_ingestion.py (new)
frontend/tests/UploadReportsPage.test.tsx
frontend/tests/workbookApi.test.ts
frontend/tests/browser/uploads.spec.ts
frontend/tests/browser/uploads-live.spec.ts
```

Documentation:

```text
backend/README.md
frontend/README.md
docs/DATA_DICTIONARY.md
docs/INGESTION_LAYOUTS.md (new)
docs/CROSS_DATASET_FINDINGS.md
docs/RECONCILIATION_RULES_SPEC.md
docs/MATCHING_DECISION_MATRIX.md
docs/RECONCILIATION_OPEN_QUESTIONS.md
docs/RECONCILIATION_ARCHITECTURE.md
```

Pre-existing uncommitted discovery changes are preserved. The design documents distinguish historical compatibility failures from the current implemented contract. No commit or push was made.

The compatibility blocker identified during discovery is resolved for these two layouts. The next proposed implementation stage is 0.9A pure object matching; no matching, ML, human review or report export is implemented here.
