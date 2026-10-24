from app.core.config import Settings
from app.core.errors import AppError
from app.services.importers.base import finish_sheet, source_rows, warning
from app.services.importers.types import ParsedSheet, UploadMessage
from app.services.normalization import is_blank, raw_text

HEADERS = ("Info", "S.No", "Object Typ", "Object Name", "Type", "Message")


def parse_upload_errors(sheet, settings: Settings) -> ParsedSheet[UploadMessage]:
    records = []
    for row in source_rows(sheet, HEADERS, settings):
        sequence = row.values["S.No"]
        if is_blank(sequence):
            sequence = None
        elif not isinstance(sequence, int) or isinstance(sequence, bool):
            raise AppError(422, "INVALID_SEQUENCE", "Errors.S.No must contain integers or blank values; original values are never inferred.")
        records.append(UploadMessage(
            **row.identity("Object Typ"),
            info_raw=raw_text(row.values["Info"]),
            sequence_number=sequence,
            message_type_raw=raw_text(row.values["Type"]),
            message_raw=raw_text(row.values["Message"]),
        ))
    extra = warning("BLANK_MESSAGE_TYPE", "Rows with blank message types were preserved without interpreting log blocks.", sheet.title, sum(is_blank(r.message_type_raw) for r in records))
    return finish_sheet(sheet.title, records, extra)
