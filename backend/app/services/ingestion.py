from dataclasses import asdict
from hashlib import sha256
import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import Cycle, Project, TransformationFinding, UploadErrorMessage, UploadObjectRecord, Workbook
from app.services.importers.types import ParsedWorkbook
from app.services.importers.workbook import parse_workbook

logger = logging.getLogger("tracesync.ingestion")


def require_project(session: Session, project_id: UUID) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise AppError(404, "PROJECT_NOT_FOUND", "Project does not exist.")
    return project


def require_cycle(session: Session, cycle_id: UUID) -> Cycle:
    cycle = session.get(Cycle, cycle_id)
    if cycle is None:
        raise AppError(404, "CYCLE_NOT_FOUND", "Cycle does not exist.")
    return cycle


def existing_workbook(session: Session, cycle_id: UUID, role: str) -> Workbook | None:
    return session.scalar(select(Workbook).where(Workbook.cycle_id == cycle_id, Workbook.role == role))


def duplicate_or_conflict(existing: Workbook, digest: str) -> tuple[Workbook, bool]:
    if existing.sha256 == digest:
        return existing, True
    raise AppError(409, "WORKBOOK_ROLE_OCCUPIED", "This cycle already has different content for that workbook role. Create another cycle; existing evidence is never replaced.")


def persist_records(session: Session, workbook_id: UUID, parsed: ParsedWorkbook) -> None:
    for model, records in [
        (TransformationFinding, parsed.transformation),
        (UploadObjectRecord, parsed.upload_objects),
        (UploadErrorMessage, parsed.upload_errors),
    ]:
        session.add_all(model(workbook_id=workbook_id, **asdict(record)) for record in records)


def ingest_workbook(
    session: Session, cycle_id: UUID, role: str, filename: str, content: bytes, settings: Settings
) -> tuple[Workbook, bool]:
    cycle = require_cycle(session, cycle_id)
    digest = sha256(content).hexdigest()
    existing = existing_workbook(session, cycle_id, role)
    if existing is not None:
        return duplicate_or_conflict(existing, digest)
    # Parsing performs no database writes. Either adapter failure aborts the upload.
    parsed = parse_workbook(content, role, settings)
    try:
        workbook = Workbook(
            cycle_id=cycle_id, role=role, original_filename=filename,
            sha256=digest, byte_size=len(content), sheets_found=parsed.sheets_found,
            row_counts=parsed.row_counts, object_counts=parsed.object_counts,
            warnings=[item.model_dump() for item in parsed.warnings],
        )
        session.add(workbook)
        session.flush()
        persist_records(session, workbook.id, parsed)
        session.flush()
        roles = session.scalar(select(func.count(Workbook.id)).where(Workbook.cycle_id == cycle_id))
        cycle.ingestion_status = "complete" if roles == 2 else "partial"
        session.commit()
        return workbook, False
    except IntegrityError:
        session.rollback()
        existing = existing_workbook(session, cycle_id, role)
        if existing is not None:
            return duplicate_or_conflict(existing, digest)
        logger.error("ingestion_failed exception_type=IntegrityError")
        raise AppError(500, "INGESTION_FAILED", "Evidence could not be saved; the upload was rolled back.") from None
    except Exception as exc:
        session.rollback()
        # Do not let source-bearing exceptions escape into server traceback logs.
        logger.error("ingestion_failed exception_type=%s", type(exc).__name__)
        raise AppError(500, "INGESTION_FAILED", "Evidence could not be saved; the upload was rolled back.") from None
