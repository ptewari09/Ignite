from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.projects import router as projects_router
from app.api.routes.workbooks import router as workbooks_router
from app.core.config import API_PREFIX

api_router = APIRouter(prefix=API_PREFIX)
api_router.include_router(health_router)
api_router.include_router(projects_router)
api_router.include_router(workbooks_router)
