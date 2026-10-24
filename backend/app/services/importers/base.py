from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Any

from app.core.config import Settings
from app.core.errors import AppError
from app.services.importers.types import ImportWarning, ParsedSheet, SourceRecord
from app.services.normalization import is_blank, normalize_header, normalize_identifier, raw_text


@dataclass
class SourceRow:
    worksheet_name: str
    excel_row_number: int
    values: dict[str, Any]
    raw_payload: dict[str, Any]

    def identity(self, type_header: str) -> dict[str, Any]:
        return {
            "worksheet_name": self.worksheet_name,
            "excel_row_number": self.excel_row_number,
            "object_type_raw": raw_text(self.values[type_header]),
            "object_name_raw": raw_text(self.values["Object Name"]),
            "object_type_normalized": normalize_identifier(self.values[type_header]),
            "object_name_normalized": normalize_identifier(self.values["Object Name"]),
            "raw_payload": self.raw_payload,
        }


def json_value(value: Any) -> Any:
    if isinstance(value, (datetime, date, time)):
        return {"type": type(value).__name__, "value": value.isoformat()}
    return value


def source_rows(sheet, headers: tuple[str, ...], settings: Settings) -> Iterator[SourceRow]:
    # Ignore incorrect/stale used-range dimensions; still enforce physical row limits.
    sheet.reset_dimensions()
    rows = sheet.iter_rows()
    first = next(rows, ())
    if len(first) > 128:
        raise AppError(422, "WORKSHEET_LIMIT", "A source worksheet exceeds 128 columns.")
    original_headers = [cell.value for cell in first]
    if any(value is not None and not isinstance(value, str) for value in original_headers):
        raise AppError(422, "INVALID_HEADERS", "Worksheet headers must be text in Excel row 1.")
    normalized = [normalize_header(value) if value is not None else "" for value in original_headers]
    nonblank = [value for value in normalized if value]
    if len(nonblank) != len(set(nonblank)):
        raise AppError(422, "AMBIGUOUS_HEADERS", "Worksheet headers collide after whitespace normalization.")
    missing = [name for name in headers if name not in normalized]
    if missing:
        raise AppError(422, "MISSING_COLUMNS", f"{sheet.title} requires columns: {', '.join(missing)}.")
    for row_number, cells in enumerate(rows, start=2):
        if row_number > settings.max_sheet_rows:
            raise AppError(422, "WORKSHEET_LIMIT", "A source worksheet exceeds the configured physical row limit.")
        if len(cells) > 128:
            raise AppError(422, "WORKSHEET_LIMIT", "A source worksheet exceeds 128 columns.")
        if all(is_blank(cell.value) for cell in cells):
            continue
        values = {}
        payload = {}
        for index, cell in enumerate(cells):
            header = normalized[index] if index < len(normalized) else ""
            if cell.data_type in {"f", "e"}:
                raise AppError(422, "UNSUPPORTED_CELL", "Source data contains a formula or Excel error cell; supply a values-only export.")
            if not header:
                if not is_blank(cell.value):
                    raise AppError(422, "INVALID_HEADERS", "A populated source column has no row-1 header.")
                continue
            values[header] = cell.value
            payload[original_headers[index]] = json_value(cell.value)
        for index, header in enumerate(normalized):
            if header and header not in values:
                values[header] = None
                payload[original_headers[index]] = None
        yield SourceRow(sheet.title, row_number, values, payload)


def warning(code: str, message: str, sheet: str, count: int) -> list[ImportWarning]:
    return [ImportWarning(code=code, message=message, worksheet_name=sheet, count=count)] if count else []


def finish_sheet(sheet: str, records: list[SourceRecord], extra: list[ImportWarning] | None = None) -> ParsedSheet:
    keys = Counter((r.object_type_normalized, r.object_name_normalized) for r in records if r.object_name_normalized)
    warnings = list(extra or [])
    warnings += warning("BLANK_OBJECT_NAME", "Rows with blank object names were preserved.", sheet, sum(r.object_name_normalized is None for r in records))
    warnings += warning("BLANK_OBJECT_TYPE", "Rows with blank object types were preserved.", sheet, sum(r.object_type_normalized is None for r in records))
    warnings += warning("REPEATED_OBJECT_KEYS", "Repeated type/name groups were preserved as separate source rows.", sheet, sum(count > 1 for count in keys.values()))
    if not records:
        warnings.append(ImportWarning(code="EMPTY_SHEET", message="The required worksheet contains headers but no data rows.", worksheet_name=sheet))
    return ParsedSheet(sheet, records, warnings)
