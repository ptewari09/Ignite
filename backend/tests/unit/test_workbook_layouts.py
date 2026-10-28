import pytest

from app.core.errors import AppError
from app.services.importers.workbook import parse_workbook
from tests.fixtures.workbooks import mutate, raw_post_upload_bytes, transformation_layout_bytes
from app.scripts.generate_demo_workbooks import post_upload_bytes


@pytest.mark.parametrize("sheet_name", ["Detailed_LOG", "Detailed_Log"])
def test_transformation_alias_preserves_all_source_locations(settings, sheet_name):
    result = parse_workbook(transformation_layout_bytes(sheet_name), "transformation", settings)
    assert result.row_counts == {sheet_name: 3}
    assert [r.excel_row_number for r in result.transformation] == [2, 4, 5]
    assert all(r.worksheet_name == sheet_name for r in result.transformation)
    assert result.transformation[0].object_name_raw == " z_demo_order "
    assert result.transformation[0].object_name_normalized == "Z_DEMO_ORDER"


@pytest.mark.parametrize("sheet_name", ["detailed_log", "Other", "Detailed_LOG_2"])
def test_arbitrary_transformation_names_are_not_aliases(settings, sheet_name):
    with pytest.raises(AppError) as caught:
        parse_workbook(transformation_layout_bytes(sheet_name), "transformation", settings)
    assert caught.value.code == "MISSING_WORKSHEETS"
    assert "Detailed_Log" in caught.value.message


def test_raw_layout_preserves_absent_columns_and_ordinal_gaps(settings):
    result = parse_workbook(raw_post_upload_bytes(), "post_upload", settings)
    assert result.row_counts == {"Sheet1": 3, "Sheet2": 4}
    assert result.object_counts["Sheet1"] == 2
    assert [r.excel_row_number for r in result.upload_objects] == [2, 3, 4]
    assert all(r.worksheet_name == "Sheet1" for r in result.upload_objects)
    for record in result.upload_objects:
        assert record.tool_status_raw is record.re_upload_raw is record.manual_status_raw is record.manual_comments_raw is None
        assert set(record.raw_payload) == {"Status Inf", "Object Typ", "Object Name".ljust(30)}
    assert result.upload_objects[0].object_name_raw == "z_demo_order".ljust(30)
    assert result.upload_objects[0].object_name_normalized == "Z_DEMO_ORDER"
    assert [r.sequence_number for r in result.upload_errors] == [1, 2, 7, 11]
    assert result.upload_errors[1].object_name_normalized is None
    assert all(r.worksheet_name == "Sheet2" for r in result.upload_errors)
    missing = next(w for w in result.warnings if w.code == "MISSING_OPTIONAL_COLUMNS")
    assert missing.count == 4 and missing.worksheet_name == "Sheet1"
    assert not any(w.code == "MANUAL_ANNOTATIONS" for w in result.warnings)


@pytest.mark.parametrize("provided", [(), ("Status",), ("Status", "Re Upload", "Manually added status", "Manually added comments")])
def test_raw_optional_columns_preserve_provided_blanks_and_annotations(settings, provided):
    def edit(book):
        sheet = book["Sheet1"]
        values = {"Status": None, "Re Upload": None, "Manually added status": "Out of scope", "Manually added comments": "Fictional imported note; not an approval."}
        for column, name in enumerate(provided, 4):
            sheet.cell(1, column).value = name
            sheet.cell(2, column).value = values[name]
    result = parse_workbook(mutate(raw_post_upload_bytes(), edit), "post_upload", settings)
    record = result.upload_objects[0]
    for header in ("Status", "Re Upload", "Manually added status", "Manually added comments"):
        assert (header in record.raw_payload) == (header in provided)
    assert record.tool_status_raw is None
    if "Status" in provided:
        assert record.raw_payload["Status"] is None
    assert record.manual_status_raw == ("Out of scope" if "Manually added status" in provided else None)
    missing = [w for w in result.warnings if w.code == "MISSING_OPTIONAL_COLUMNS"]
    assert [w.count for w in missing] == ([4 - len(provided)] if len(provided) < 4 else [])


@pytest.mark.parametrize("column", [1, 2, 3])
def test_raw_core_columns_remain_required(settings, column):
    content = mutate(raw_post_upload_bytes(), lambda book: book["Sheet1"].delete_cols(column))
    with pytest.raises(AppError) as caught:
        parse_workbook(content, "post_upload", settings)
    assert caught.value.code == "MISSING_COLUMNS"


@pytest.mark.parametrize("column", [4, 5, 6, 7])
def test_named_layout_retains_its_full_required_contract(settings, column):
    content = mutate(post_upload_bytes(), lambda book: book["Objects"].delete_cols(column))
    with pytest.raises(AppError) as caught:
        parse_workbook(content, "post_upload", settings)
    assert caught.value.code == "MISSING_COLUMNS"


@pytest.mark.parametrize("column", range(1, 7))
def test_raw_technical_message_columns_remain_required(settings, column):
    content = mutate(raw_post_upload_bytes(), lambda book: book["Sheet2"].delete_cols(column))
    with pytest.raises(AppError) as caught:
        parse_workbook(content, "post_upload", settings)
    assert caught.value.code == "MISSING_COLUMNS"


def test_both_complete_layouts_are_rejected_without_choosing_one(settings):
    def edit(book):
        book.copy_worksheet(book["Objects"]).title = "Sheet1"
        book.copy_worksheet(book["Errors"]).title = "Sheet2"
    with pytest.raises(AppError) as caught:
        parse_workbook(mutate(post_upload_bytes(), edit), "post_upload", settings)
    assert caught.value.code == "AMBIGUOUS_LAYOUT"


@pytest.mark.parametrize("change,code", [
    (lambda b: b["Sheet1"].cell(1, 4, " Object Name "), "AMBIGUOUS_HEADERS"),
    (lambda b: b["Sheet1"].cell(4, 5, "Unlabelled fictional value"), "INVALID_HEADERS"),
    (lambda b: (b["Sheet1"].cell(1, 4, "Status"), b["Sheet1"].cell(2, 4, "=1+1")), "UNSUPPORTED_CELL"),
    (lambda b: b["Sheet2"].cell(2, 2, "not-an-integer"), "INVALID_SEQUENCE"),
    (lambda b: b.remove(b["Sheet2"]), "MISSING_WORKSHEETS"),
    (lambda b: setattr(b["Sheet1"], "title", "Objects"), "MISSING_WORKSHEETS"),
])
def test_raw_invalid_inputs_keep_existing_validation(settings, change, code):
    with pytest.raises(AppError) as caught:
        parse_workbook(mutate(raw_post_upload_bytes(), change), "post_upload", settings)
    assert caught.value.code == code


def test_large_duplicate_group_preserves_rows_without_multiplying_messages(settings):
    def edit(book):
        first = [cell.value for cell in book["Sheet1"][2]]
        for _ in range(13):
            book["Sheet1"].append(first)
    result = parse_workbook(mutate(raw_post_upload_bytes(), edit), "post_upload", settings)
    assert len(result.upload_objects) == 16
    assert sum(r.object_name_normalized == "Z_DEMO_ORDER" for r in result.upload_objects) == 15
    assert len(result.upload_errors) == 4
