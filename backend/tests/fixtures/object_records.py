"""Fictional identity snapshots; no enterprise identifiers or message copies."""

from app.services.normalization import normalize_header, normalize_identifier
from app.services.reconciliation import ObjectRecord


def record(record_id, name="Z_DEMO_JOB", object_type="PROG", **overrides):
    values = {
        "source_record_id": record_id,
        "object_type_raw": object_type,
        "object_name_raw": name,
        "object_type_normalized": normalize_identifier(object_type),
        "object_name_normalized": normalize_identifier(name),
    }
    values.update(overrides)
    return ObjectRecord(**values)


def snapshot(source, *, workbook_id, record_id=None):
    # A future loader must preserve original cell types rather than hide them
    # behind the ingestion model's text conversion. Only identity cells enter
    # this snapshot; messages/manual annotations stay on the original source.
    payload = {normalize_header(header): value for header, value in source.raw_payload.items()}
    return ObjectRecord(
        source_record_id=record_id, workbook_id=workbook_id,
        worksheet_name=source.worksheet_name, excel_row_number=source.excel_row_number,
        object_type_raw=payload.get("Object Type", payload.get("Object Typ")),
        object_name_raw=payload.get("Object Name"),
        object_type_normalized=source.object_type_normalized,
        object_name_normalized=source.object_name_normalized,
    )
