from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, Request, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import DatabaseSession, Limit, Offset
from app.core.errors import AppError
from app.db.models import TransformationFinding, UploadErrorMessage, UploadObjectRecord, Workbook
from app.schemas.ingestion import Page, TransformationResponse, UploadErrorResponse, UploadObjectResponse, WorkbookResponse, WorkbookRole, WorkbookUploadResponse
from app.services.ingestion import ingest_workbook, require_cycle

router = APIRouter(tags=["Workbook evidence"])


@router.post("/cycles/{cycle_id}/workbooks", response_model=WorkbookUploadResponse, status_code=201, responses={200: {"description": "Identical content already ingested"}})
def upload_workbook(
    cycle_id: UUID, request: Request, response: Response, session: DatabaseSession,
    role: Annotated[WorkbookRole, Form()], file: Annotated[UploadFile, File()],
):
    try:
        require_cycle(session, cycle_id)
        filename = (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1]
        if not filename.lower().endswith(".xlsx"):
            raise AppError(415, "UNSUPPORTED_FILE_TYPE", "Upload an .xlsx workbook; .XLSX is also accepted.")
        if len(filename) > 255 or any(ord(character) < 32 for character in filename):
            raise AppError(422, "INVALID_FILENAME", "Use a filename without control characters, up to 255 characters long.")
        settings = request.app.state.settings
        if file.size is not None and file.size > settings.max_upload_bytes:
            raise AppError(413, "UPLOAD_TOO_LARGE", "Workbook exceeds TRACESYNC_MAX_UPLOAD_BYTES.")
        # Bound the file-part read even if the client omits or falsifies its size.
        content = file.file.read(settings.max_upload_bytes + 1)
        if len(content) > settings.max_upload_bytes:
            raise AppError(413, "UPLOAD_TOO_LARGE", "Workbook exceeds TRACESYNC_MAX_UPLOAD_BYTES.")
        workbook, duplicate = ingest_workbook(session, cycle_id, role.value, filename, content, settings)
        if duplicate:
            response.status_code = 200
        return {"workbook": workbook, "duplicate": duplicate}
    finally:
        file.file.close()


@router.get("/cycles/{cycle_id}/workbooks", response_model=Page[WorkbookResponse])
def list_workbooks(cycle_id: UUID, session: DatabaseSession, limit: Limit = 50, offset: Offset = 0):
    require_cycle(session, cycle_id)
    condition = Workbook.cycle_id == cycle_id
    return {
        "items": session.scalars(select(Workbook).where(condition).order_by(Workbook.uploaded_at, Workbook.id).limit(limit).offset(offset)).all(),
        "total": session.scalar(select(func.count(Workbook.id)).where(condition)), "limit": limit, "offset": offset,
    }


def evidence_page(session: Session, cycle_id: UUID, model, limit: int, offset: int):
    require_cycle(session, cycle_id)
    query = select(model).join(Workbook).where(Workbook.cycle_id == cycle_id)
    total = session.scalar(select(func.count()).select_from(query.subquery()))
    records = session.scalars(query.order_by(model.excel_row_number, model.id).limit(limit).offset(offset)).all()
    return {"items": records, "total": total, "limit": limit, "offset": offset}


@router.get("/cycles/{cycle_id}/transformation-findings", response_model=Page[TransformationResponse])
def transformation_findings(cycle_id: UUID, session: DatabaseSession, limit: Limit = 50, offset: Offset = 0):
    return evidence_page(session, cycle_id, TransformationFinding, limit, offset)


@router.get("/cycles/{cycle_id}/upload-objects", response_model=Page[UploadObjectResponse])
def upload_objects(cycle_id: UUID, session: DatabaseSession, limit: Limit = 50, offset: Offset = 0):
    return evidence_page(session, cycle_id, UploadObjectRecord, limit, offset)


@router.get("/cycles/{cycle_id}/upload-errors", response_model=Page[UploadErrorResponse])
def upload_errors(cycle_id: UUID, session: DatabaseSession, limit: Limit = 50, offset: Offset = 0):
    return evidence_page(session, cycle_id, UploadErrorMessage, limit, offset)
