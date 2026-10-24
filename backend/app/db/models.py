from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.engine import Dialect
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class UTCDateTime(TypeDecorator[datetime]):
    """Store UTC in SQLite and restore timezone-aware values on ORM reads."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Timestamps must include a timezone")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return value.replace(tzinfo=UTC) if value is not None else None


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="ck_projects_name_not_blank"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=utc_now, onupdate=utc_now, nullable=False
    )


class Cycle(Base):
    __tablename__ = "cycles"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="ck_cycles_name_not_blank"),
        CheckConstraint("ingestion_status IN ('empty', 'partial', 'complete')", name="ck_cycles_status"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, nullable=False)
    ingestion_status: Mapped[str] = mapped_column(String(20), default="empty", nullable=False)


class Workbook(Base):
    __tablename__ = "workbooks"
    __table_args__ = (
        UniqueConstraint("cycle_id", "role", name="uq_workbooks_cycle_role"),
        CheckConstraint("role IN ('transformation', 'post_upload')", name="ck_workbooks_role"),
        CheckConstraint("ingestion_status = 'ingested'", name="ck_workbooks_status"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    cycle_id: Mapped[UUID] = mapped_column(ForeignKey("cycles.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, nullable=False)
    ingestion_status: Mapped[str] = mapped_column(String(20), default="ingested", nullable=False)
    sheets_found: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    row_counts: Mapped[dict[str, int]] = mapped_column(JSON, nullable=False)
    object_counts: Mapped[dict[str, int]] = mapped_column(JSON, nullable=False)
    warnings: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)


class EvidenceColumns:
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    workbook_id: Mapped[UUID] = mapped_column(ForeignKey("workbooks.id"), nullable=False, index=True)
    worksheet_name: Mapped[str] = mapped_column(String(100), nullable=False)
    excel_row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    object_type_raw: Mapped[str | None] = mapped_column(Text)
    object_name_raw: Mapped[str | None] = mapped_column(Text)
    object_type_normalized: Mapped[str | None] = mapped_column(Text)
    object_name_normalized: Mapped[str | None] = mapped_column(Text)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class TransformationFinding(EvidenceColumns, Base):
    __tablename__ = "transformation_findings"
    __table_args__ = (
        UniqueConstraint("workbook_id", "worksheet_name", "excel_row_number", name="uq_transformation_source_row"),
        CheckConstraint("excel_row_number >= 2", name="ck_transformation_source_row"),
    )

    status_raw: Mapped[str | None] = mapped_column(Text)
    error_category_raw: Mapped[str | None] = mapped_column(Text)
    error_message_raw: Mapped[str | None] = mapped_column(Text)
    suggested_action_raw: Mapped[str | None] = mapped_column(Text)
    file_name_raw: Mapped[str | None] = mapped_column(Text)


class UploadObjectRecord(EvidenceColumns, Base):
    __tablename__ = "upload_objects"
    __table_args__ = (
        UniqueConstraint("workbook_id", "worksheet_name", "excel_row_number", name="uq_upload_object_source_row"),
        CheckConstraint("excel_row_number >= 2", name="ck_upload_object_source_row"),
    )

    status_info_raw: Mapped[str | None] = mapped_column(Text)
    tool_status_raw: Mapped[str | None] = mapped_column(Text)
    re_upload_raw: Mapped[str | None] = mapped_column(Text)
    manual_status_raw: Mapped[str | None] = mapped_column(Text)
    manual_comments_raw: Mapped[str | None] = mapped_column(Text)


class UploadErrorMessage(EvidenceColumns, Base):
    __tablename__ = "upload_errors"
    __table_args__ = (
        UniqueConstraint("workbook_id", "worksheet_name", "excel_row_number", name="uq_upload_error_source_row"),
        CheckConstraint("excel_row_number >= 2", name="ck_upload_error_source_row"),
    )

    info_raw: Mapped[str | None] = mapped_column(Text)
    sequence_number: Mapped[int | None] = mapped_column(Integer)
    message_type_raw: Mapped[str | None] = mapped_column(Text)
    message_raw: Mapped[str | None] = mapped_column(Text)
