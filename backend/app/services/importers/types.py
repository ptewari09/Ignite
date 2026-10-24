from dataclasses import dataclass, field
from typing import Any, Generic, TypeVar

from pydantic import BaseModel


class ImportWarning(BaseModel):
    code: str
    message: str
    worksheet_name: str | None = None
    count: int = 1


@dataclass(frozen=True)
class SourceRecord:
    worksheet_name: str
    excel_row_number: int
    object_type_raw: str | None
    object_name_raw: str | None
    object_type_normalized: str | None
    object_name_normalized: str | None
    raw_payload: dict[str, Any]


@dataclass(frozen=True)
class TransformationRecord(SourceRecord):
    status_raw: str | None
    error_category_raw: str | None
    error_message_raw: str | None
    suggested_action_raw: str | None
    file_name_raw: str | None


@dataclass(frozen=True)
class UploadObject(SourceRecord):
    status_info_raw: str | None
    tool_status_raw: str | None
    re_upload_raw: str | None
    manual_status_raw: str | None
    manual_comments_raw: str | None


@dataclass(frozen=True)
class UploadMessage(SourceRecord):
    info_raw: str | None
    sequence_number: int | None
    message_type_raw: str | None
    message_raw: str | None


RecordType = TypeVar("RecordType", bound=SourceRecord)


@dataclass
class ParsedSheet(Generic[RecordType]):
    worksheet_name: str
    records: list[RecordType]
    warnings: list[ImportWarning]

    @property
    def object_count(self) -> int:
        return len({r.object_name_normalized for r in self.records if r.object_name_normalized})


@dataclass
class ParsedWorkbook:
    sheets_found: list[str]
    transformation: list[TransformationRecord] = field(default_factory=list)
    upload_objects: list[UploadObject] = field(default_factory=list)
    upload_errors: list[UploadMessage] = field(default_factory=list)
    row_counts: dict[str, int] = field(default_factory=dict)
    object_counts: dict[str, int] = field(default_factory=dict)
    warnings: list[ImportWarning] = field(default_factory=list)
