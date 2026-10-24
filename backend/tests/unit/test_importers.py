from openpyxl import Workbook
import pytest

from app.core.errors import AppError
from app.scripts.generate_demo_workbooks import post_upload_bytes, transformation_bytes, workbook_bytes
from app.services.importers.workbook import parse_workbook
from tests.fixtures.workbooks import mutate


def test_transformation_preserves_rows_raw_text_duplicates_and_blanks(settings):
    result = parse_workbook(transformation_bytes(), "transformation", settings)
    assert result.row_counts == {"Detailed_LOG": 3}
    assert result.object_counts == {"Detailed_LOG": 1}
    assert [record.excel_row_number for record in result.transformation] == [2, 4, 5]
    first, repeated, blank = result.transformation
    assert first.object_name_raw == " z_demo_order "
    assert first.object_type_raw == " prog  "
    assert first.object_name_normalized == repeated.object_name_normalized == "Z_DEMO_ORDER"
    assert first.error_message_raw.endswith("  ")
    assert first.file_name_raw is None and repeated.suggested_action_raw is None
    assert blank.object_name_normalized is None and blank.error_category_raw is None
    assert any(w.code == "REPEATED_OBJECT_KEYS" for w in result.warnings)


def test_post_upload_preserves_separate_manual_fields_and_unnamed_logs(settings):
    result = parse_workbook(post_upload_bytes(), "post_upload", settings)
    assert result.row_counts == {"Objects": 3, "Errors": 4}
    assert result.object_counts == {"Objects": 2, "Errors": 2}
    first = result.upload_objects[0]
    assert first.tool_status_raw == "UPLD_ERROR"
    assert first.manual_status_raw == "Uploaded"
    assert first.manual_comments_raw == "Synthetic review comment A."
    assert first.raw_payload["Status    "] == "UPLD_ERROR"
    unnamed = result.upload_errors[1]
    assert unnamed.object_type_raw == "    " and unnamed.object_type_normalized is None
    assert unnamed.object_name_raw is None and unnamed.object_name_normalized is None
    assert unnamed.sequence_number == 2
    assert "Message        " in unnamed.raw_payload
    assert result.upload_errors[2].message_type_raw == "   "


def test_unknown_columns_are_retained_with_original_headers(settings):
    def add_extra(book):
        book["Detailed_LOG"]["H1"] = " Extra detail "
        book["Detailed_LOG"]["H2"] = "Synthetic extra field"
    result = parse_workbook(mutate(transformation_bytes(), add_extra), "transformation", settings)
    assert result.transformation[0].raw_payload[" Extra detail "] == "Synthetic extra field"


@pytest.mark.parametrize("change,code", [
    (lambda book: book.remove(book["Detailed_LOG"]), "MISSING_WORKSHEETS"),
    (lambda book: setattr(book["Detailed_LOG"]["C1"], "value", "Wrong header"), "MISSING_COLUMNS"),
    (lambda book: setattr(book["Detailed_LOG"]["H1"], "value", " Object Name "), "AMBIGUOUS_HEADERS"),
    (lambda book: setattr(book["Detailed_LOG"]["E2"], "value", "=1+1"), "UNSUPPORTED_CELL"),
    (lambda book: setattr(book["Detailed_LOG"]["H2"], "value", "Unlabeled synthetic data"), "INVALID_HEADERS"),
])
def test_invalid_schemas_and_untrusted_cells_fail_without_content(settings, change, code):
    # An auxiliary empty sheet keeps the workbook serializable when deleting its source tab.
    def edit(book):
        book.create_sheet("Unused")
        change(book)
    with pytest.raises(AppError) as caught:
        parse_workbook(mutate(transformation_bytes(), edit), "transformation", settings)
    assert caught.value.code == code
    assert "Z_DEMO_ORDER" not in caught.value.message


def test_invalid_sequence_is_not_silently_converted(settings):
    content = mutate(post_upload_bytes(), lambda book: setattr(book["Errors"]["B2"], "value", "private-sequence-text"))
    with pytest.raises(AppError) as caught:
        parse_workbook(content, "post_upload", settings)
    assert caught.value.code == "INVALID_SEQUENCE"
    assert "private-sequence-text" not in caught.value.message


def test_declared_limits_bound_workbook_processing(settings):
    with pytest.raises(AppError) as expanded:
        parse_workbook(transformation_bytes(), "transformation", settings.model_copy(update={"max_workbook_uncompressed_bytes": 10}))
    assert expanded.value.status_code == 413
    with pytest.raises(AppError) as rows:
        parse_workbook(transformation_bytes(), "transformation", settings.model_copy(update={"max_sheet_rows": 3}))
    assert rows.value.code == "WORKSHEET_LIMIT"


@pytest.mark.parametrize("content", [b"", b"not excel", b"PK\x03\x04broken-zip"])
def test_malformed_files_produce_safe_errors(settings, content):
    with pytest.raises(AppError) as caught:
        parse_workbook(content, "transformation", settings)
    assert caught.value.code == "INVALID_WORKBOOK"


def test_summary_is_not_required_and_empty_sheet_is_visible(settings):
    book = Workbook()
    sheet = book.active
    sheet.title = "Detailed_LOG"
    sheet.append(["Status", "Object Type", "Object Name", "Error Category", "Message", "Suggested Action", "File Name"])
    result = parse_workbook(workbook_bytes(book), "transformation", settings)
    assert result.row_counts == {"Detailed_LOG": 0}
    assert any(w.code == "EMPTY_SHEET" for w in result.warnings)
