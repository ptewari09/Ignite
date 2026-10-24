from app.core.config import Settings
from app.services.importers.base import finish_sheet, source_rows, warning
from app.services.importers.types import ParsedSheet, TransformationRecord
from app.services.normalization import is_blank, raw_text

HEADERS = ("Status", "Object Type", "Object Name", "Error Category", "Message", "Suggested Action", "File Name")


def parse_transformation(sheet, settings: Settings) -> ParsedSheet[TransformationRecord]:
    records = [
        TransformationRecord(
            **row.identity("Object Type"),
            status_raw=raw_text(row.values["Status"]),
            error_category_raw=raw_text(row.values["Error Category"]),
            error_message_raw=raw_text(row.values["Message"]),
            suggested_action_raw=raw_text(row.values["Suggested Action"]),
            file_name_raw=raw_text(row.values["File Name"]),
        )
        for row in source_rows(sheet, HEADERS, settings)
    ]
    extra = warning("BLANK_CATEGORY", "Rows with blank transformation categories were preserved without classification.", sheet.title, sum(is_blank(r.error_category_raw) for r in records))
    return finish_sheet(sheet.title, records, extra)
