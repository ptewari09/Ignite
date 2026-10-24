from app.core.config import Settings
from app.services.importers.base import finish_sheet, source_rows, warning
from app.services.importers.types import ParsedSheet, UploadObject
from app.services.normalization import is_blank, raw_text

HEADERS = ("Status Inf", "Object Typ", "Object Name", "Status", "Re Upload", "Manually added status", "Manually added comments")


def parse_upload_objects(sheet, settings: Settings) -> ParsedSheet[UploadObject]:
    records = [
        UploadObject(
            **row.identity("Object Typ"),
            status_info_raw=raw_text(row.values["Status Inf"]),
            tool_status_raw=raw_text(row.values["Status"]),
            re_upload_raw=raw_text(row.values["Re Upload"]),
            manual_status_raw=raw_text(row.values["Manually added status"]),
            manual_comments_raw=raw_text(row.values["Manually added comments"]),
        )
        for row in source_rows(sheet, HEADERS, settings)
    ]
    count = sum(not is_blank(r.manual_status_raw) or not is_blank(r.manual_comments_raw) for r in records)
    extra = warning("MANUAL_ANNOTATIONS", "Imported manual annotations are separate from tool status and do not imply approval.", sheet.title, count)
    return finish_sheet(sheet.title, records, extra)
