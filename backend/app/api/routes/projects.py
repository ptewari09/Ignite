from uuid import UUID

from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.dependencies import DatabaseSession, Limit, Offset
from app.db.models import Cycle, Project
from app.schemas.ingestion import CycleCreate, CycleResponse, Page, ProjectCreate, ProjectResponse
from app.services.ingestion import require_project

router = APIRouter(tags=["Projects and cycles"])


@router.post("/projects", response_model=ProjectResponse, status_code=201)
def create_project(body: ProjectCreate, session: DatabaseSession) -> Project:
    project = Project(**body.model_dump())
    session.add(project)
    session.commit()
    return project


@router.get("/projects", response_model=Page[ProjectResponse])
def list_projects(session: DatabaseSession, limit: Limit = 50, offset: Offset = 0):
    return {
        "items": session.scalars(select(Project).order_by(Project.created_at, Project.id).limit(limit).offset(offset)).all(),
        "total": session.scalar(select(func.count(Project.id))), "limit": limit, "offset": offset,
    }


@router.post("/projects/{project_id}/cycles", response_model=CycleResponse, status_code=201)
def create_cycle(project_id: UUID, body: CycleCreate, session: DatabaseSession) -> Cycle:
    require_project(session, project_id)
    cycle = Cycle(project_id=project_id, name=body.name)
    session.add(cycle)
    session.commit()
    return cycle


@router.get("/projects/{project_id}/cycles", response_model=Page[CycleResponse])
def list_cycles(project_id: UUID, session: DatabaseSession, limit: Limit = 50, offset: Offset = 0):
    require_project(session, project_id)
    condition = Cycle.project_id == project_id
    return {
        "items": session.scalars(select(Cycle).where(condition).order_by(Cycle.created_at, Cycle.id).limit(limit).offset(offset)).all(),
        "total": session.scalar(select(func.count(Cycle.id)).where(condition)), "limit": limit, "offset": offset,
    }
