"""The 31 object-level projections of the 91-scenario design matrix."""

from collections import Counter
from dataclasses import asdict

import pytest

from app.services.reconciliation import SourceRole, reconcile_objects
from tests.fixtures.object_records import record as r


ACCEPTANCE_IDS = tuple(f"O{i:02}" for i in range(1, 23)) + ("C03", "C06", "C07", "X01", "X02", "X03", "X04", "X07", "X10")


def scenario(identifier):
    # Expected counts are SHARED, TRANSFORMATION_ONLY, UPLOAD_ONLY, NEEDS_REVIEW.
    if identifier in {"O01", "X04", "X10"}:
        return [r("T")], [r("U")], (1, 0, 0, 0)
    if identifier in {"O02", "C03"}:
        return [r("T", " z_demo_job ", " prog ")], [r("U")], (1, 0, 0, 0)
    if identifier == "O03":
        return [r("T", "\u00a0z_demo_job\u00a0")], [r("U")], (1, 0, 0, 0)
    if identifier == "O04":
        return [r("T", "Z_DEMO  JOB")], [r("U", "Z_DEMO JOB")], (0, 0, 0, 2)
    if identifier == "O05":
        return [r("T", "Z_DEMO_\u00df")], [r("U", "Z_DEMO_SS")], (0, 0, 0, 2)
    if identifier == "O06":
        return [r("T", 123)], [r("U", "123")], (0, 0, 0, 2)
    if identifier == "O07":
        return [r("T", "/DEMO/CL_RULE=>CHECK", "CLAS")], [r("U", "/DEMO/CL_RULE=>CHECK", "CLAS")], (1, 0, 0, 0)
    if identifier == "O08":
        return [r("T", "ZCL_DEMO_RULE", "CLAS")], [r("U", "ZCL_DEMO_RULE=>CHECK", "METH")], (0, 1, 1, 0)
    if identifier == "O09":
        return [r("T", object_type=None)], [r("U")], (0, 0, 0, 2)
    if identifier == "O10":
        return [r("T", object_type=None)], [r("U", object_type=None)], (0, 0, 0, 2)
    if identifier == "O11":
        return [r("T")], [r("U", object_type="CLAS")], (0, 0, 0, 2)
    if identifier == "O12":
        return [r("T", object_type=None)], [r("U1"), r("U2", object_type="CLAS")], (0, 0, 0, 3)
    if identifier == "O13":
        return [r("T", object_type="CLAS")], [r("U1", object_type="CLAS"), r("U2")], (1, 0, 0, 1)
    if identifier in {"O14", "O15"}:
        return [r("T1", worksheet_name="Detailed_LOG", excel_row_number=2), r("T2", worksheet_name="Detailed_LOG", excel_row_number=3)], [r("U")], (1, 0, 0, 0)
    if identifier == "O16":
        return [r("T")], [r("U1"), r("U2")], (1, 0, 0, 0)
    if identifier in {"O17", "X03"}:
        return [r("T")], [], (0, 1, 0, 0)
    if identifier in {"O18", "X01"}:
        return [], [r("U")], (0, 0, 1, 0)
    if identifier == "O19":
        return [r("T", None)], [r("U", None)], (0, 0, 0, 2)
    if identifier == "O20":
        return [r("T", object_type="DEMO_TYPE")], [r("U", object_type="DEMO_TYPE")], (0, 0, 0, 2)
    if identifier == "O21":
        return [r("T")], [r("U", "Z_DEMO_JOB_EXTRA")], (0, 1, 1, 0)
    if identifier == "O22":
        return [r("T", project_id="P", cycle_id="A")], [r("U", project_id="P", cycle_id="B")], None
    if identifier == "C06":
        return [r("T")], [r(f"U{i:02}") for i in range(15)], (1, 0, 0, 0)
    if identifier == "C07":
        return [r("T1", "Z_DEMO_DUAL", "PROG"), r("T2", "Z_DEMO_DUAL", "FUGR")], [], (0, 2, 0, 0)
    if identifier == "X02":
        return [], [], (0, 0, 0, 0)
    if identifier == "X07":
        return [r("T1"), r("T2"), r("T3", "Z_DEMO_ONLY_T")], [r("U1"), r("U2", "Z_DEMO_ONLY_U")], (1, 1, 1, 0)
    raise AssertionError(f"Missing synthetic acceptance specification: {identifier}")


@pytest.mark.parametrize("identifier", ACCEPTANCE_IDS)
def test_object_acceptance_scenario(identifier):
    transformation, upload, expected = scenario(identifier)
    if expected is None:
        with pytest.raises(ValueError, match="consistent project/cycle"):
            reconcile_objects(transformation, upload)
        return
    before = asdict(reconcile_objects(transformation, upload))
    result = reconcile_objects(iter(transformation), iter(upload))
    assert tuple(asdict(result.summary.outcomes).values()) == expected
    assert result.summary.total_cases == sum(expected)
    assert result.summary.source_rows.transformation == len(transformation)
    assert result.summary.source_rows.upload == len(upload)
    actual_refs = Counter((ref.source_role, ref.source_record_id) for case in result.cases for ref in case.evidence)
    expected_refs = Counter([(SourceRole.TRANSFORMATION, row.source_record_id) for row in transformation] + [(SourceRole.UPLOAD, row.source_record_id) for row in upload])
    assert actual_refs == expected_refs
    assert before == asdict(result) == asdict(reconcile_objects(reversed(transformation), reversed(upload)))
    assert all(case.explanation and bool(case.review_flags) == (case.outcome == "NEEDS_REVIEW") for case in result.cases)
    if identifier == "C07":
        assert result.summary.distinct_observed_names == 1
        assert result.summary.distinct_observed_typed_keys == 2
    if identifier == "C06":
        assert result.cases[0].source_rows.upload == 15
