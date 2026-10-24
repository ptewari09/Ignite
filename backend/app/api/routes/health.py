import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.session import get_session
from app.schemas.health import HealthResponse, ReadinessResponse

router = APIRouter(tags=["Health"])
logger = logging.getLogger("tracesync.readiness")


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@router.get("/ready", response_model=ReadinessResponse, responses={503: {"description": "Database unavailable"}})
def ready(
    request: Request, session: Annotated[Session, Depends(get_session)]
) -> ReadinessResponse:
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.warning(
            "database_unavailable request_id=%s exception_type=%s",
            request.state.request_id, type(exc).__name__,
        )
        raise AppError(503, "DATABASE_UNAVAILABLE", "Database connection is unavailable.") from None
    return ReadinessResponse()
