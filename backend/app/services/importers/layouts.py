"""Explicit source worksheet layouts; headers are validated by each adapter."""

from dataclasses import dataclass

from app.core.errors import AppError


@dataclass(frozen=True)
class WorkbookLayout:
    transformation_sheet: str | None = None
    object_sheet: str | None = None
    error_sheet: str | None = None
    optional_object_status: bool = False


def select_layout(sheet_names: list[str], role: str) -> WorkbookLayout:
    names = set(sheet_names)
    if role == "transformation":
        candidates = [name for name in ("Detailed_LOG", "Detailed_Log") if name in names]
        if len(candidates) > 1:
            raise AppError(422, "AMBIGUOUS_LAYOUT", "Multiple supported transformation worksheets were found. Supply exactly one Detailed_LOG or Detailed_Log worksheet.")
        if not candidates:
            raise AppError(422, "MISSING_WORKSHEETS", "Required transformation worksheet is missing: supply Detailed_LOG or Detailed_Log.")
        return WorkbookLayout(transformation_sheet=candidates[0])

    candidates = [
        WorkbookLayout(object_sheet=objects, error_sheet=errors, optional_object_status=optional)
        for objects, errors, optional in (("Objects", "Errors", False), ("Sheet1", "Sheet2", True))
        if {objects, errors} <= names
    ]
    if len(candidates) > 1:
        raise AppError(422, "AMBIGUOUS_LAYOUT", "Both post-upload worksheet layouts were found. Supply exactly one Objects/Errors or Sheet1/Sheet2 pair.")
    if candidates:
        return candidates[0]
    expected = ("Sheet1", "Sheet2") if names & {"Sheet1", "Sheet2"} and not names & {"Objects", "Errors"} else ("Objects", "Errors")
    missing = [name for name in expected if name not in names]
    raise AppError(422, "MISSING_WORKSHEETS", f"Required worksheets are missing: {', '.join(missing)}. Accepted post-upload layouts are Objects/Errors or Sheet1/Sheet2.")
