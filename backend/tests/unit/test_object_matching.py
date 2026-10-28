from collections import Counter
from copy import deepcopy
from dataclasses import FrozenInstanceError, asdict, fields
from itertools import permutations
import json
from pathlib import Path
import socket
import sqlite3

import pytest

from app.services.importers.workbook import parse_workbook
from app.services.reconciliation import MatchOutcome, ObjectRecord, ReviewFlag, SourceRole, reconcile_objects
from tests.fixtures.object_records import record, snapshot
from tests.fixtures.workbooks import raw_post_upload_bytes, transformation_layout_bytes
from app.scripts.generate_demo_workbooks import post_upload_bytes


def keyed(result, object_type="PROG", name="Z_DEMO_JOB"):
    return next(case for case in result.cases if case.typed_key and (case.typed_key.object_type, case.typed_key.object_name) == (object_type, name))


def test_repeated_rows_are_one_case_with_all_evidence_and_exact_summary():
    transformation = [record("T2"), record("T1"), record("T3", "Z_DEMO_ONLY_T")]
    upload = [record("U2"), record("U1"), record("U3", "Z_DEMO_ONLY_U")]
    result = reconcile_objects(transformation, upload)
    shared = keyed(result)
    assert shared.outcome == MatchOutcome.SHARED
    assert [ref.source_record_id for ref in shared.evidence] == ["T1", "T2", "U1", "U2"]
    assert (shared.source_rows.transformation, shared.source_rows.upload) == (2, 2)
    assert result.summary.total_cases == result.summary.grouped_typed_keys == 3
    assert result.summary.unkeyed_review_cases == 0
    assert result.summary.source_rows.total == 6
    assert result.summary.review_rows.total == 0
    assert asdict(result.summary.outcomes) == {"shared": 1, "transformation_only": 1, "upload_only": 1, "needs_review": 0}


@pytest.mark.parametrize("left,right", [
    (" z_demo_job ", "Z_DEMO_JOB"),
    ("\u00a0z_demo_job\u00a0", "Z_DEMO_JOB"),
])
def test_benign_variants_are_not_normalization_collisions(left, right):
    result = reconcile_objects([record("T", left, " prog ")], [record("U", right)])
    assert result.summary.outcomes.shared == 1
    assert not result.cases[0].review_flags
    assert result.cases[0].evidence[0].object_name_raw == left


@pytest.mark.parametrize("left,right,flag", [
    ("Z_DEMO  JOB", "Z_DEMO JOB", ReviewFlag.INTERNAL_WHITESPACE),
    ("Z_DEMO_\u00df", "Z_DEMO_SS", ReviewFlag.NON_ASCII_IDENTITY),
    (123, "123", ReviewFlag.NON_TEXT_IDENTITY),
    (True, "TRUE", ReviewFlag.NON_TEXT_IDENTITY),
])
def test_lossy_normalization_collisions_quarantine_every_affected_source_row(left, right, flag):
    result = reconcile_objects([record("T", left)], [record("U", right)])
    assert result.summary.distinct_observed_typed_keys == 1
    assert result.summary.grouped_typed_keys == 0
    assert result.summary.unkeyed_review_cases == 2
    assert result.summary.outcomes.needs_review == 2
    assert result.summary.review_rows.total == 2
    assert all(ReviewFlag.NORMALIZATION_COLLISION in case.review_flags and case.typed_key is None for case in result.cases)
    assert any(flag in case.review_flags for case in result.cases)
    assert reconcile_objects([record("T", left)], [record("U", right)]) == result


def test_normalized_fields_conflicting_with_raw_values_are_not_repaired():
    bad = record("T", "Z_DEMO_RAW", object_name_normalized="Z_DEMO_OTHER")
    result = reconcile_objects([bad], [record("U", "Z_DEMO_RAW")])
    assert result.summary.outcomes.needs_review == 2
    assert any(ReviewFlag.NORMALIZATION_MISMATCH in case.review_flags for case in result.cases)
    assert keyed(result, name="Z_DEMO_RAW").review_flags == (ReviewFlag.UNCERTAIN_OTHER_SOURCE,)
    assert next(ref for case in result.cases for ref in case.evidence if ref.source_record_id == "T").object_name_normalized == "Z_DEMO_OTHER"


@pytest.mark.parametrize("field", ["object_type_normalized", "object_name_normalized"])
@pytest.mark.parametrize("empty", [None, "", "   "])
def test_missing_normalized_values_remain_review_records(field, empty):
    result = reconcile_objects([record("T", **{field: empty})], [])
    assert result.summary.outcomes.needs_review == 1
    assert result.summary.outcomes.transformation_only == 0
    assert result.cases[0].typed_key is None


def test_missing_name_only_blocks_compatible_opposite_types_not_established_shared_keys():
    transformation = [record("T0", None, "PROG"), record("T1", "Z_DEMO_SHARED")]
    upload = [record("U1", "Z_DEMO_SHARED"), record("U2", "Z_DEMO_POSSIBLE"), record("U3", "ZCL_DEMO_OTHER", "CLAS")]
    result = reconcile_objects(transformation, upload)
    assert keyed(result, name="Z_DEMO_SHARED").outcome == MatchOutcome.SHARED
    assert keyed(result, name="Z_DEMO_POSSIBLE").outcome == MatchOutcome.NEEDS_REVIEW
    assert keyed(result, "CLAS", "ZCL_DEMO_OTHER").outcome == MatchOutcome.UPLOAD_ONLY
    assert result.summary.outcomes.needs_review == 2


def test_fully_unknown_opposite_identity_prevents_all_one_sided_absence_claims():
    result = reconcile_objects([record("T", None, None)], [record("U1"), record("U2", "ZCL_DEMO_OTHER", "CLAS")])
    assert result.summary.outcomes.needs_review == 3
    assert result.summary.outcomes.upload_only == 0


def test_exact_typed_match_survives_an_additional_incompatible_type():
    result = reconcile_objects([record("T", object_type="CLAS")], [record("U1", object_type="CLAS"), record("U2")])
    assert keyed(result, "CLAS").outcome == MatchOutcome.SHARED
    assert keyed(result).outcome == MatchOutcome.NEEDS_REVIEW
    assert keyed(result).review_flags == (ReviewFlag.DIFFERENT_TYPE_SAME_NAME,)


def test_unknown_type_is_preserved_without_adding_an_alias():
    result = reconcile_objects([record("T", object_type="DEMO_TYPE")], [record("U", object_type="DEMO_TYPE")])
    assert result.summary.outcomes.needs_review == 2
    assert all(ReviewFlag.UNKNOWN_OBJECT_TYPE in case.review_flags for case in result.cases)
    assert all(case.evidence[0].object_type_raw == "DEMO_TYPE" for case in result.cases)


def test_full_provenance_is_preserved_and_inputs_outputs_are_immutable():
    original = record("T", worksheet_name="Detailed_Log", excel_row_number=41, workbook_id="WB_T", project_id="P", cycle_id="C")
    upload = record("U", worksheet_name="Sheet1", excel_row_number=7, workbook_id="WB_U", project_id="P", cycle_id="C")
    inputs = [original, upload]
    before = deepcopy(inputs)
    result = reconcile_objects(inputs[:1], inputs[1:])
    assert inputs == before
    assert result.project_id == "P" and result.cycle_id == "C"
    for ref, source in zip(result.cases[0].evidence, inputs):
        assert all(getattr(ref, field.name) == getattr(source, field.name) for field in fields(ObjectRecord))
    assert [ref.source_role for ref in result.cases[0].evidence] == [SourceRole.TRANSFORMATION, SourceRole.UPLOAD]
    with pytest.raises(FrozenInstanceError):
        original.object_name_raw = "CHANGED"
    with pytest.raises(FrozenInstanceError):
        result.cases[0].outcome = MatchOutcome.UPLOAD_ONLY
    with pytest.raises(FrozenInstanceError):
        result.cases[0].evidence[0].source_record_id = "CHANGED"


def test_invalid_provenance_is_preserved_for_review_even_with_a_record_id():
    source = record("T", worksheet_name="Detailed_LOG", excel_row_number=0)
    result = reconcile_objects([source], [record("U")])
    assert result.summary.outcomes.needs_review == 2
    review = next(case for case in result.cases if case.typed_key is None)
    assert review.evidence[0].excel_row_number == 0
    assert ReviewFlag.INVALID_SOURCE_LOCATION in review.review_flags
    assert keyed(result).review_flags == (ReviewFlag.UNCERTAIN_OTHER_SOURCE,)


def test_keyed_case_id_depends_on_scope_and_identity_not_evidence_membership():
    first = reconcile_objects([record("T", project_id="P", cycle_id="C")], [])
    second = reconcile_objects(
        [record("T", project_id="P", cycle_id="C"), record("T2", project_id="P", cycle_id="C")],
        [record("U", project_id="P", cycle_id="C")],
    )
    assert first.cases[0].case_id == second.cases[0].case_id
    assert first.cases[0].outcome == MatchOutcome.TRANSFORMATION_ONLY
    assert second.cases[0].outcome == MatchOutcome.SHARED
    assert second.cases[0].source_rows.total == 3


def test_missing_record_ids_and_locations_are_never_fabricated():
    source = record(None, worksheet_name="Detailed_LOG", excel_row_number=3)
    result = reconcile_objects([source], [record("U")])
    assert result.cases[0].outcome == MatchOutcome.SHARED
    assert result.cases[0].evidence[0].source_record_id is None
    assert result.cases[0].evidence[0].workbook_id is None
    untraceable = record(None)
    repeated = reconcile_objects([untraceable, untraceable], [])
    assert repeated.summary.outcomes.needs_review == 2
    assert len({case.case_id for case in repeated.cases}) == 2
    assert all(case.evidence[0].source_record_id is None and case.evidence[0].excel_row_number is None for case in repeated.cases)
    assert all(ReviewFlag.UNTRACEABLE_SOURCE in case.review_flags for case in repeated.cases)


def test_input_order_has_no_effect_on_ids_order_flags_or_serialized_output():
    transformation = [record("T1", "Z_DEMO_B"), record("T2", "Z_DEMO_A"), record("T3", None)]
    upload = [record("U1", "Z_DEMO_B"), record("U2", "Z_DEMO_A"), record("U3", "ZCL_DEMO_X", "CLAS")]
    expected = reconcile_objects(transformation, upload)
    encoded = json.dumps(asdict(expected), sort_keys=True)
    for left in permutations(transformation):
        for right in permutations(upload):
            assert json.dumps(asdict(reconcile_objects(iter(left), iter(right))), sort_keys=True) == encoded
    assert len({case.case_id for case in expected.cases}) == len(expected.cases)


@pytest.mark.parametrize("field", ["project_id", "cycle_id"])
def test_scope_mixing_and_partial_context_are_invalid_input_contracts(field):
    with pytest.raises(ValueError, match="consistent project/cycle"):
        reconcile_objects([record("T", **{field: "FIRST"})], [record("U", **{field: "SECOND"})])
    with pytest.raises(ValueError, match="partial supplied context"):
        reconcile_objects([record("T", **{field: "FIRST"})], [record("U")])


def test_independent_scopes_and_source_record_id_namespaces_do_not_leak():
    first = reconcile_objects([record("SAME", cycle_id="A")], [])
    second = reconcile_objects([], [record("SAME", cycle_id="B")])
    assert first.summary.outcomes.transformation_only == second.summary.outcomes.upload_only == 1
    assert first.cases[0].case_id != second.cases[0].case_id
    assert reconcile_objects([record("SAME")], [record("SAME")]).summary.outcomes.shared == 1


def test_duplicate_physical_source_references_are_rejected_not_counted_twice():
    with pytest.raises(ValueError, match="record ID"):
        reconcile_objects([record("T"), record("T")], [])
    with pytest.raises(ValueError, match="row location"):
        reconcile_objects([record("T1", worksheet_name="Detailed_LOG", excel_row_number=2), record("T2", worksheet_name="Detailed_LOG", excel_row_number=2)], [])
    with pytest.raises(ValueError, match="one workbook"):
        reconcile_objects([record("T1", workbook_id="A"), record("T2", workbook_id="B")], [])


def test_engine_requires_snapshot_contract_and_has_no_io(monkeypatch):
    def prohibited(*args, **kwargs):
        raise AssertionError("The object matcher attempted I/O")
    with monkeypatch.context() as guard:
        guard.setattr(sqlite3, "connect", prohibited)
        guard.setattr(socket, "socket", prohibited)
        guard.setattr(Path, "read_bytes", prohibited)
        result = reconcile_objects([record("T")], [record("U")])
    assert result.summary.outcomes.shared == 1
    with pytest.raises(TypeError, match="ObjectRecord snapshots"):
        reconcile_objects([{"object_type_normalized": "PROG"}], [])


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_non_finite_values_are_invalid_snapshot_contracts(value):
    with pytest.raises(ValueError, match="non-finite"):
        record("T", value)


def test_layout_independent_snapshots_match_without_copying_messages_or_annotations(settings):
    results = []
    originals = []
    for sheet_name, upload_bytes in (("Detailed_LOG", post_upload_bytes()), ("Detailed_Log", raw_post_upload_bytes())):
        transformation = parse_workbook(transformation_layout_bytes(sheet_name), "transformation", settings)
        upload = parse_workbook(upload_bytes, "post_upload", settings)
        before = deepcopy((transformation, upload))
        result = reconcile_objects(
            [snapshot(row, workbook_id="WB_T") for row in transformation.transformation],
            [snapshot(row, workbook_id="WB_U") for row in upload.upload_objects],
        )
        assert (transformation, upload) == before
        assert all(ref.worksheet_name == sheet_name for case in result.cases for ref in case.evidence if ref.source_role == SourceRole.TRANSFORMATION)
        encoded = json.dumps(asdict(result))
        for excluded in ("raw_payload", "manual_comments_raw", "error_category_raw", "Fictional request", "Synthetic review comment"):
            assert excluded not in encoded
        results.append(result)
        originals.append(before)
    assert results[0].summary == results[1].summary
    assert [(c.case_id, c.outcome, c.typed_key, c.source_rows) for c in results[0].cases if c.typed_key] == [(c.case_id, c.outcome, c.typed_key, c.source_rows) for c in results[1].cases if c.typed_key]
    assert originals[0][1].upload_objects[0].manual_status_raw == "Uploaded"
    assert originals[1][1].upload_objects[0].manual_status_raw is None


def test_thousands_of_records_conserve_rows_and_keys_without_pair_expansion():
    transformation = [record(f"T{i}", f"Z_DEMO_{i:05}") for i in range(3000)]
    upload = [record(f"U{i}", f"Z_DEMO_{i:05}") for i in range(1500, 4500)]
    result = reconcile_objects(transformation, upload)
    assert result.summary.total_cases == result.summary.grouped_typed_keys == 4500
    assert result.summary.source_rows.total == 6000
    assert asdict(result.summary.outcomes) == {"shared": 1500, "transformation_only": 1500, "upload_only": 1500, "needs_review": 0}
    assert sum(len(case.evidence) for case in result.cases) == 6000
    assert Counter(ref.source_role for case in result.cases for ref in case.evidence) == {SourceRole.TRANSFORMATION: 3000, SourceRole.UPLOAD: 3000}
