import pytest

from app.services.normalization import normalize_header, normalize_identifier


@pytest.mark.parametrize("value,expected", [
    (None, None), ("", None), (" \t\u00a0", None),
    ("  prog   ", "PROG"), (" z_demo_order ", "Z_DEMO_ORDER"),
    (" /demo/cl_test=>do_work ", "/DEMO/CL_TEST=>DO_WORK"),
    (" Z_demo\u00a0  method ", "Z_DEMO METHOD"), (123, "123"),
])
def test_comparison_keys_preserve_identifiers_and_handle_blanks(value, expected):
    assert normalize_identifier(value) == expected


def test_headers_normalize_whitespace_without_merging_distinct_fields():
    assert normalize_header(" Message       ") == "Message"
    assert normalize_header("Manually\u00a0added   comments") == "Manually added comments"
    assert normalize_header("Object Typ") != normalize_header("Object Type")
