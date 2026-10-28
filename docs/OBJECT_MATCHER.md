# Deterministic object matcher

Implemented contract, version `object-match-v1`, 2026-10-28. This pure backend component compares identity snapshots from transformation findings and upload objects. It performs no database, filesystem, HTTP or external-service operations. It neither reads technical messages nor compares errors. Integration with persisted source rows and the UI remains future work.

Source: [domain records](../backend/app/services/reconciliation/domain.py), [matcher](../backend/app/services/reconciliation/object_matching.py), [unit coverage](../backend/tests/unit/test_object_matching.py), [acceptance coverage](../backend/tests/unit/test_object_acceptance.py). Broader plans remain in the [rules specification](RECONCILIATION_RULES_SPEC.md) and [architecture](RECONCILIATION_ARCHITECTURE.md).

## Calling contract

```python
from app.services.reconciliation import ObjectRecord, reconcile_objects

transformation = ObjectRecord(
    source_record_id="fictional-transformation-id",
    workbook_id="fictional-workbook-a",
    worksheet_name="Detailed_Log",
    excel_row_number=2,
    project_id="fictional-project",
    cycle_id="fictional-cycle",
    object_type_raw=" prog ",
    object_name_raw=" z_demo_job ",
    object_type_normalized="PROG",
    object_name_normalized="Z_DEMO_JOB",
)
upload = ObjectRecord(
    source_record_id="fictional-upload-id",
    workbook_id="fictional-workbook-b",
    worksheet_name="Sheet1",
    excel_row_number=2,
    project_id="fictional-project",
    cycle_id="fictional-cycle",
    object_type_raw="PROG",
    object_name_raw="Z_DEMO_JOB",
    object_type_normalized="PROG",
    object_name_normalized="Z_DEMO_JOB",
)
result = reconcile_objects([transformation], [upload])
assert result.cases[0].outcome == "SHARED"
```

Both arguments accept iterables of frozen `ObjectRecord` snapshots; generators and empty collections work. An empty collection means no supplied rows, not proof that a required workbook was uploaded. A future orchestrator must load the complete selected source pair and distinguish absent workbooks from headers-only inputs. ORM instances, dictionaries and output evidence references are rejected as input.

| Input field | Type and meaning |
|---|---|
| `object_type_raw`, `object_name_raw` | Required fields containing original immutable scalars: string, integer, finite float, boolean or null. Non-text identities are retained for review |
| `object_type_normalized`, `object_name_normalized` | Required fields containing stored string or null; the matcher checks them against the shared normalizer without replacing them |
| `source_record_id` | Optional stable string ID within the source role; a future ORM loader must explicitly convert its UUID to text |
| `workbook_id` | Optional string identifying the workbook; no filename, file path or XLSX bytes are required |
| `worksheet_name`, `excel_row_number` | Optional original sheet and integer Excel row; retain actual spelling and physical row, not adapter aliases or list positions |
| `project_id`, `cycle_id` | Optional string context, validated consistently across all supplied rows |

All optional fields default to null. No source ID, workbook ID, location or context is fabricated. The caller should retain the original scalar cell type from the preserved payload: an identity previously converted to text cannot reveal that it originally came from a numeric cell. No production loader is implemented here; the layout tests use a synthetic-only snapshot helper.

Raw structured values and non-finite floats are invalid contracts. Text fields must be strings or null; Excel rows must be integers, excluding booleans. Malformed identity content inside this scalar contract becomes a review case rather than a guessed match.

## Identity and classification

The matcher reuses `normalize_identifier`: blank values become null; other values use `" ".join(str(value).split()).upper()`. Supplied normalized fields must equal this result. The matcher preserves original and supplied values even when they disagree.

An eligible row has a complete checked type/name, traceable provenance, and no normalization/type risks. The initial observed type vocabulary is `PROG`, `FUGR`, `CLAS`, `FUNC`, `METH`, `INCL`; this is a conservative application policy, not approval of universal SAP semantics. Unknown tokens remain visible for review.

| Outcome | Condition |
|---|---|
| `SHARED` | Eligible rows with exactly equal normalized type **and** name occur in both collections |
| `TRANSFORMATION_ONLY` | Eligible typed group occurs only in transformation, with no conflicting or incomplete opposite identity that could account for it |
| `UPLOAD_ONLY` | Corresponding one-sided upload-object case |
| `NEEDS_REVIEW` | Missing/unsafe identity or provenance; cross-source same-name/different-type conflict; or opposite-side uncertainty that prevents a one-sided absence conclusion |

Each eligible typed key has one case holding every contributing physical source row. Repeated rows are not deduplicated, and no pairwise Cartesian expansion is generated. Same-name/different-type keys on only one side remain separate one-sided cases when the opposite input has no potentially corresponding row. An established exact typed pair survives an additional incompatible type under the same name.

Missing-type records are never joined by name. Unsafe records each remain an individual unkeyed review case, including repeated unsafe rows. No candidate edges, fuzzy relationships, parent/component links, sequence-block links or error-level correspondences are produced. This replaces the earlier proposed `POSSIBLE_OBJECT_MATCH` behavior for missing types; the four outcomes above are authoritative for this component.

### Collision detection

1. Group observed nonempty supplied normalized type/name pairs for inspection, including unsafe rows.
2. Compare each raw type/name pair using a signature that preserves original scalar type, non-ASCII spelling and internal whitespace. Only surrounding whitespace and ASCII case are ignored.
3. If several signatures collapse to one supplied normalized pair, add `NORMALIZATION_COLLISION` to **every** affected row. They remain separate review cases without a trusted typed key.

For example, fictional `Z_DEMO_ß` and `Z_DEMO_SS`, numeric `123` and text `123`, or `Z_DEMO  JOB` and `Z_DEMO JOB` must not become confirmed identity through string conversion, whitespace collapse or Unicode uppercase expansion. Simple ASCII casing and surrounding Unicode whitespace are benign variants. A risky row still requires review when no collision partner is supplied.

Risk flags also identify missing type/name, mismatched raw/normalized fields, non-text/non-ASCII identity, internal whitespace and unknown type. A record is traceable with either a nonblank source ID or a nonblank sheet plus Excel row at least 2. A supplied row below 2 is flagged even when an ID exists. Partial provenance remains as supplied; missing metadata is not invented.

### Incomplete opposite-side evidence

Unsafe evidence does not create a link. It may limit what can be concluded about an otherwise eligible one-sided group:

- A supplied or raw-normalized name limits absence claims for that name.
- An unnamed row with a trustworthy known type limits absence claims for that type.
- A row with neither usable name nor trustworthy type limits all opposite one-sided absence claims.

Such eligible groups retain their checked typed key and receive `UNCERTAIN_OTHER_SOURCE`; their unsafe counterpart stays in its own unkeyed case. Exact pairs already supported on both sides remain shared unless a normalization collision invalidates that key itself. This conservative policy can increase review burden; it never silently attributes the incomplete row.

## Scope and source integrity

When any project or cycle context is supplied, that field must be supplied consistently on every row. Mixed projects/cycles, partial context, several workbook IDs within one role, repeated source IDs within a role, or repeated physical locations `(workbook ID, sheet, row)` within a role raise `ValueError`. These are invalid caller contracts, not new identity outcomes. IDs from different roles have separate namespaces.

Physical duplicates at different locations/IDs are preserved. Re-supplying the same identified source row twice is rejected to prevent accidental double-counting. Indistinguishable records lacking IDs and locations are retained as separate untraceable review cases. If all context is omitted, the caller remains responsible for selecting one source pair; the engine cannot infer project/cycle membership.

## Output and evidence

All public input/output records are frozen dataclasses with tuple evidence/flag/case collections.

- `ReconciliationResult`: algorithm version, supplied project/cycle, ordered cases and summary.
- `ObjectCase`: deterministic internal case ID, one of four outcomes, checked `TypedObjectKey` when reliable, evidence tuple, per-role row counts, explanation and explicit review flags.
- `EvidenceReference`: source role (`transformation` or `post_upload`) plus every input field unchanged, including raw scalar identity and original sheet/Excel row.
- `ReconciliationSummary`: the counts below. `OutcomeCounts` counts cases; `SourceRowCounts` counts source occurrences and exposes a `total` property.

No raw payload, technical message, category, imported manual status/comment or customer-action field enters the engine or match summaries. Original evidence remains available independently through existing evidence APIs. Object overlap never means corresponding errors, successful remediation, customer scope or report approval.

| Summary field | Exact meaning |
|---|---|
| `total_cases` | Number of logical keyed cases plus individual unkeyed review cases |
| `grouped_typed_keys` | Number of eligible typed groups, including groups requiring review because of opposite-side conflict/uncertainty |
| `unkeyed_review_cases` | Number of individually quarantined unsafe source occurrences |
| `distinct_observed_typed_keys` | Distinct nonempty supplied normalized pairs, including unsafe pairs; not a count of verified objects |
| `distinct_observed_names` | Distinct nonempty supplied normalized names, including unsafe names; not interchangeable with typed-key count |
| `source_rows` | Total supplied rows independently for transformation and upload |
| `review_rows` | All contributing rows in `NEEDS_REVIEW` cases, independently by role; includes eligible rows whose comparison is inconclusive |
| `outcomes` | Case counts for shared, transformation-only, upload-only and needs-review |

Every input occurrence contributes to exactly one case and one role count. `total_cases = grouped_typed_keys + unkeyed_review_cases`; outcome counts sum to total cases. Review counts count rows, not candidate relationships.

## Determinism and complexity

Keyed IDs are SHA-256 digests of supplied project/cycle plus normalized type/name. They are local comparison identifiers, not global SAP object IDs. Adding evidence under the same key does not change that ID. Unkeyed review IDs hash the complete identity/provenance reference and use deterministic occurrence numbers for indistinguishable missing-provenance rows. These internal IDs never fill missing source IDs.

Evidence sorts by role (transformation first), workbook, actual worksheet, Excel row, source ID and canonical scalar data. Cases sort by type/name, outcome and case ID. Flags sort by their stable string values. Canonical JSON digests do not use Python's randomized hash. Equivalent list/generator orderings produce identical full serialized outputs; there are no timestamps, random IDs or mutable global caches.

For `n` rows and `L` identity/provenance text size, indexing and normalization take expected `O(L + n)` time. Evidence/case sorting makes total time `O(L + n log n)` for bounded identifier lengths; text-comparison/serialization cost scales with identifier length. Space is `O(L + n)` including output. There is no all-to-all object comparison. Rule constants are immutable; all working state belongs to one call.

## Verification and acceptance scope

The design matrix still contains **91** scenarios. **31** have applicable object-level acceptance projections, automated in `test_object_acceptance.py`:

| IDs | Executed coverage |
|---|---|
| O01–O22 | Complete/incomplete/conflicting identities, collisions, literal punctuation, repeats, separate one-sided groups and rejected mixed scope |
| C03, C06, C07 | Padding/case, fifteen repeated upload rows, and separate types under one name with distinct name/key counts |
| X01, X02 | Empty transformation collection and both collections empty; no workbook-presence warnings claimed |
| X03, X04 | Empty upload-object collection or object matching independently of technical-message availability; message preservation/attribution remains outside this test |
| X07 | Input-order independence and source conservation |
| X10 | Complete in-memory identity snapshots require no original XLSX; production persisted-row loading remains unimplemented |

O14–O16 and C06 exercise identity grouping/evidence references only: categories, payloads and manual notes remain on the original source, outside the matcher contract. Separate synthetic layout tests verify both adapters produce equivalent matching summaries while retaining actual sheet provenance and leaving source records unchanged. The other 60 matrix scenarios are not claimed as object-engine acceptance; some existing ingestion/isolation cases remain covered by their own regression tests.

Verification on Windows/Python 3.12.4, 2026-10-28:

- **64 new matcher tests passed**, including the 31 acceptance cases and a 6,000-row conservation test.
- **167 backend tests passed, one confidential-data test intentionally skipped**. The existing upstream TestClient/httpx deprecation warning remains; no dependency changes were made.
- Syntax/import/static boundary checks and whitespace checks passed. The repository has no configured backend linter or type checker; no new checker was installed.
- Separate interpreter runs with different `PYTHONHASHSEED` values produced identical serialized-result digests.
- All pre-existing frontend/ingestion/model/schema/route/migration files were checked against the pre-work snapshot. The normal database and all six confidential workbook hashes were unchanged; no normal-database connection or real-data matching run was needed.

Synthetic matching-only benchmark: 9,000 transformation rows plus 6,000 upload rows, including 1,000 repeated transformation keys, yielded 10,000 cases: 4,000 shared, 4,000 transformation-only, 2,000 upload-only, zero review. Three timed calls took **0.8125 / 0.8648 / 0.8011 seconds** (median **0.8125 seconds**) on the development laptop. Input construction, workbook parsing, persistence and UI time are excluded. This is neither a portable latency guarantee nor a matching-accuracy or human-time-saving result.

From the repository root in Windows PowerShell:

```powershell
& .\backend\.venv\Scripts\python.exe -m pytest -c backend/pyproject.toml backend/tests/unit/test_object_matching.py backend/tests/unit/test_object_acceptance.py -q
& .\backend\.venv\Scripts\python.exe -m pytest -c backend/pyproject.toml backend/tests -q
```

No service startup, migration, network connection, extra dependency or pre-existing database is required to call the pure matcher. Existing pytest integration tests continue to use temporary migrated databases. Next proposed stage: pure message attribution and narrowly justified error-evidence comparison, subject to the unresolved rule gates in the [question register](RECONCILIATION_OPEN_QUESTIONS.md); no part of that stage is implemented here.
