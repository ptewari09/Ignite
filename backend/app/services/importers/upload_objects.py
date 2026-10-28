from app.core.config import Settings
from app.services.importers.base import finish_sheet, source_rows, warning
from app.services.importers.types import ImportWarning, ParsedSheet, UploadObject
from app.services.normalization import is_blank, normalize_header, raw_text

HEADERS = ("Status Inf", "Object Typ", "Object Name", "Status", "Re Upload", "Manually added status", "Manually added comments")
IDENTITY_HEADERS = HEADERS[:3]
STATUS_HEADERS = HEADERS[3:]


def parse_upload_objects(sheet, settings: Settings, *, optional_status_columns: bool = False) -> ParsedSheet[UploadObject]:
    headers = IDENTITY_HEADERS if optional_status_columns else HEADERS
    # Preserve absent columns as absent payload keys. Supplied blank cells
    # already remain present with null values in source_rows.
    missing_status_columns: set[str] = set()
    if optional_status_columns:
        sheet.reset_dimensions()
        supplied = {normalize_header(cell.value) for cell in next(sheet.iter_rows(), ()) if isinstance(cell.value, str)}
        missing_status_columns = set(STATUS_HEADERS) - supplied
    records = [
        UploadObject(
            **row.identity("Object Typ"),
            status_info_raw=raw_text(row.values["Status Inf"]),
            tool_status_raw=raw_text(row.values.get("Status")),
            re_upload_raw=raw_text(row.values.get("Re Upload")),
            manual_status_raw=raw_text(row.values.get("Manually added status")),
            manual_comments_raw=raw_text(row.values.get("Manually added comments")),
        )
        for row in source_rows(sheet, headers, settings)
    ]
    count = sum(not is_blank(r.manual_status_raw) or not is_blank(r.manual_comments_raw) for r in records)
    extra = warning("MANUAL_ANNOTATIONS", "Imported manual annotations are separate from tool status and do not imply approval.", sheet.title, count)
    if missing_status_columns:
        missing = ", ".join(name for name in STATUS_HEADERS if name in missing_status_columns)
        extra.append(ImportWarning(code="MISSING_OPTIONAL_COLUMNS", message=f"Source columns not supplied: {missing}. Missing source values remain unknown; no statuses or annotations were inferred.", worksheet_name=sheet.title, count=len(missing_status_columns)))
    return finish_sheet(sheet.title, records, extra)
