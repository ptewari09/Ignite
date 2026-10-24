import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker

from app.api.router import api_router
from app.core.config import SERVICE_NAME, Settings
from app.core.errors import register_exception_handlers
from app.core.logging import RequestLoggingMiddleware
from app.db.session import create_database_engine


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings if settings is not None else Settings()
    engine = create_database_engine(settings)

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        logging.basicConfig(
            level=settings.log_level,
            format="%(asctime)s %(levelname)s %(name)s %(message)s",
        )
        # Database connections and tables are not created during startup.
        try:
            yield
        finally:
            engine.dispose()

    application = FastAPI(title=SERVICE_NAME, version="0.1.0", lifespan=lifespan)
    application.state.settings = settings
    application.state.engine = engine
    application.state.session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        expose_headers=["X-Request-ID"],
    )
    application.add_middleware(RequestLoggingMiddleware)
    register_exception_handlers(application)
    application.include_router(api_router)
    return application


app = create_app()
