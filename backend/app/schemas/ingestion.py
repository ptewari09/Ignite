from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.services.importers.types import ImportWarning

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Item = TypeVar("Item")


class Page(BaseModel, Generic[Item]):
    items: list[Item]
    total: int
    limit: int
    offset: int


class ORMResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Name
    description: str | None = Field(default=None, max_length=4000)


class ProjectResponse(ORMResponse):
    id: UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class CycleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Name


class CycleResponse(ORMResponse):
    id: UUID
    project_id: UUID
    name: str
    created_at: datetime
    ingestion_status: str


class WorkbookRole(StrEnum):
    TRANSFORMATION = "transformation"
    POST_UPLOAD = "post_upload"


class WorkbookResponse(ORMResponse):
    id: UUID
    cycle_id: UUID
    role: WorkbookRole
    original_filename: str
    sha256: str
    byte_size: int
    uploaded_at: datetime
    ingestion_status: str
    sheets_found: list[str]
    row_counts: dict[str, int]
    object_counts: dict[str, int]
    warnings: list[ImportWarning]


class WorkbookUploadResponse(BaseModel):
    workbook: WorkbookResponse
    duplicate: bool


class EvidenceResponse(ORMResponse):
    id: UUID
    workbook_id: UUID
    worksheet_name: str
    excel_row_number: int
    object_type_raw: str | None
    object_name_raw: str | None
    object_type_normalized: str | None
    object_name_normalized: str | None
    raw_payload: dict[str, Any]


class TransformationResponse(EvidenceResponse):
    status_raw: str | None
    error_category_raw: str | None
    error_message_raw: str | None
    suggested_action_raw: str | None
    file_name_raw: str | None


class UploadObjectResponse(EvidenceResponse):
    status_info_raw: str | None
    tool_status_raw: str | None
    re_upload_raw: str | None
    manual_status_raw: str | None
    manual_comments_raw: str | None


class UploadErrorResponse(EvidenceResponse):
    info_raw: str | None
    sequence_number: int | None
    message_type_raw: str | None
    message_raw: str | None
