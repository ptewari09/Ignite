"""Local, read-only workbook profiling; no reconciliation or classification.

Output contains headers, counts and pseudonymized examples. Free text, paths
inside cells and real object identifiers are not emitted. Treat output as
internal metadata nonetheless. Requires an already available openpyxl.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from hashlib import sha256
import json
from pathlib import Path
from typing import Any
import warnings

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter


CATEGORICAL_HEADERS = {
    "Status", "Status Inf", "Object Type", "Object Typ", "Error Category",
    "Re Upload", "Manually added status", "Info", "Type",
}


def blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def normalized_name(value: Any) -> str:
    """Inspection-only name counting; this does not establish SAP identity."""
    return " ".join(str(value).split()).upper() if not blank(value) else ""


def profile_workbooks(paths: list[Path]) -> dict[str, Any]:
    aliases: dict[str, str] = {}

    def safe_value(header: str, value: Any) -> Any:
        if blank(value):
            return None
        if header == "Object Name":
            key = normalized_name(value)
            return aliases.setdefault(key, f"OBJECT_{len(aliases) + 1:04d}")
        if header in CATEGORICAL_HEADERS:
            return str(value).strip()
        if header == "S.No" and isinstance(value, (int, float)):
            return value
        return f"<redacted {type(value).__name__}; {len(str(value))} characters>"

    result: dict[str, Any] = {
        "method": "OpenPyXL; nonblank rows after row-1 header; no workbook saves",
        "sanitization": "Object aliases are run-local; free-text examples are redacted.",
        "workbooks": [],
    }
    for path in paths:
        digest_before = sha256(path.read_bytes()).hexdigest()
        with warnings.catch_warnings(record=True) as caught, path.open("rb") as source:
            warnings.simplefilter("ignore", DeprecationWarning)
            warnings.simplefilter("ignore", ResourceWarning)
            warnings.simplefilter("always", UserWarning)
            book = load_workbook(source, data_only=False, keep_links=False)
        workbook_info: dict[str, Any] = {
            "file": path.name,
            "bytes": path.stat().st_size,
            "sha256": digest_before,
            "warnings": [str(item.message) for item in caught],
            "sheet_order": book.sheetnames,
            "sheets": [],
        }
        try:
            for sheet in book:
                all_rows = list(sheet.iter_rows())
                populated = [row for row in all_rows if any(not blank(c.value) for c in row)]
                header_cells = all_rows[0] if populated else ()
                headers = [str(c.value) if c.value is not None else "" for c in header_cells]
                records = [row for row in all_rows[1:] if any(not blank(c.value) for c in row)]
                columns = []
                for index, raw_header in enumerate(headers):
                    header = raw_header.strip()
                    cells = [row[index] for row in records]
                    values = [c.value for c in cells if not blank(c.value)]
                    column: dict[str, Any] = {
                        "position": index + 1,
                        "letter": get_column_letter(index + 1),
                        "header_raw": raw_header,
                        "header_length": len(raw_header),
                        "header_trimmed": header,
                        "nonempty": len(values),
                        "missing": len(cells) - len(values),
                        "whitespace_only": sum(isinstance(c.value, str) and bool(c.value) and not c.value.strip() for c in cells),
                        "python_types": dict(Counter(type(v).__name__ for v in values)),
                        "excel_types": dict(Counter(c.data_type for c in cells if not blank(c.value))),
                        "distinct_nonempty": len({str(v) for v in values}),
                        "examples": [safe_value(header, v) for v in values[:3]],
                        "style_ids": dict(Counter(c.style_id for c in cells)),
                    }
                    if header in CATEGORICAL_HEADERS:
                        column["value_frequencies_trimmed"] = dict(sorted(Counter(str(v).strip() for v in values).items()))
                    columns.append(column)
                name_index = next((i for i, h in enumerate(headers) if h.strip() == "Object Name"), None)
                type_index = next((i for i, h in enumerate(headers) if h.strip() in {"Object Type", "Object Typ"}), None)
                identity: dict[str, Any] = {}
                if name_index is not None:
                    groups: dict[str, list[int]] = defaultdict(list)
                    typed_groups: dict[tuple[str, str], list[int]] = defaultdict(list)
                    for row in records:
                        key = normalized_name(row[name_index].value)
                        if key:
                            groups[key].append(row[0].row)
                            if type_index is not None:
                                typed_groups[(normalized_name(row[type_index].value), key)].append(row[0].row)
                    duplicate_groups = [(key, rows) for key, rows in groups.items() if len(rows) > 1]
                    identity = {
                        "name_column": get_column_letter(name_index + 1),
                        "type_column": get_column_letter(type_index + 1) if type_index is not None else None,
                        "blank_names": sum(blank(row[name_index].value) for row in records),
                        "unique_normalized_names": len(groups),
                        "repeated_name_groups": len(duplicate_groups),
                        "extra_rows_beyond_unique_names": sum(len(rows) - 1 for rows in groups.values()),
                        "rows_per_name_histogram": dict(sorted(Counter(len(rows) for rows in groups.values()).items())),
                        "duplicate_groups": [{"object": safe_value("Object Name", key), "rows": rows} for key, rows in duplicate_groups],
                        "unique_type_name_keys": len(typed_groups) if type_index is not None else None,
                        "names_with_multiple_types": sum(len({t for t, n in typed_groups if n == key}) > 1 for key in groups) if type_index is not None else None,
                        "name_normalization_changes": sum(str(row[name_index].value) != normalized_name(row[name_index].value) for row in records if not blank(row[name_index].value)),
                    }
                values_by_row = [tuple((type(c.value).__name__, str(c.value)) for c in row) for row in records]
                info = {
                    "name": sheet.title,
                    "state": sheet.sheet_state,
                    "dimension_including_formatting": sheet.calculate_dimension(),
                    "populated_rows_including_header": len(populated),
                    "header_row": 1 if populated else None,
                    "data_rows": len(records),
                    "blank_rows_after_header_in_dimension": max(len(all_rows) - 1 - len(records), 0),
                    "data_excel_row_range": [records[0][0].row, records[-1][0].row] if records else None,
                    "columns": columns,
                    "object_identity": identity,
                    "exact_duplicate_rows_beyond_first": sum(n - 1 for n in Counter(values_by_row).values()),
                    "sanitized_first_five_records": [{"excel_row": row[0].row, "values": {get_column_letter(i + 1): safe_value(h.strip(), row[i].value) for i, h in enumerate(headers)}} for row in records[:5]],
                    "merged_ranges": [str(r) for r in sheet.merged_cells.ranges],
                    "formula_cells": [c.coordinate for row in all_rows for c in row if c.data_type == "f"],
                    "excel_error_cells": [c.coordinate for row in all_rows for c in row if c.data_type == "e"],
                    "comments_count": sum(c.comment is not None for row in all_rows for c in row),
                    "hyperlink_count": sum(c.hyperlink is not None for row in all_rows for c in row),
                    "hidden_rows": [i for i, d in sheet.row_dimensions.items() if d.hidden],
                    "hidden_columns": [k for k, d in sheet.column_dimensions.items() if d.hidden],
                    "tables": list(sheet.tables),
                    "pivot_count": len(sheet._pivots),
                    "data_validation_count": len(sheet.data_validations.dataValidation),
                    "conditional_formatting_ranges": len(sheet.conditional_formatting),
                    "filter": sheet.auto_filter.ref,
                    "freeze_panes": sheet.freeze_panes,
                    "column_widths": {key: dim.width for key, dim in sheet.column_dimensions.items()},
                    "row_dimension_count": len(sheet.row_dimensions),
                    "custom_row_height_count": sum(dim.height is not None for dim in sheet.row_dimensions.values()),
                    "row_dimension_max_index": max(sheet.row_dimensions, default=0),
                    "wrapped_cell_count": sum(bool(c.alignment.wrap_text) for row in all_rows for c in row),
                    "header_style_ids": [c.style_id for c in header_cells],
                    "styled_cell_count": sum(c.has_style for row in all_rows for c in row),
                }
                workbook_info["sheets"].append(info)
        finally:
            book.close()
        if sha256(path.read_bytes()).hexdigest() != digest_before:
            raise RuntimeError(f"Source changed during inspection: {path.name}")
        workbook_info["source_hash_unchanged"] = True
        result["workbooks"].append(workbook_info)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbooks", nargs="+", type=Path)
    parser.add_argument("--output", type=Path, help="Optional JSON report; use a gitignored local data directory")
    args = parser.parse_args()
    paths = [p.resolve() for p in args.workbooks]
    for path in paths:
        if path.suffix.lower() != ".xlsx" or not path.is_file():
            parser.error(f"Expected an existing .xlsx workbook: {path.name}")
    if args.output and args.output.resolve() in paths:
        parser.error("Output must not overwrite an input workbook")
    report = json.dumps(profile_workbooks(paths), indent=2, ensure_ascii=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report, encoding="utf-8")
        print(f"Inspected {len(paths)} workbooks; report written to {args.output}")
    else:
        print(report, end="")


if __name__ == "__main__":
    main()
