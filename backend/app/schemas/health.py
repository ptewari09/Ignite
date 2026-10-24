from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["healthy"] = "healthy"
    service: Literal["TraceSync API"] = "TraceSync API"


class ReadinessResponse(BaseModel):
    status: Literal["ready"] = "ready"
    service: Literal["TraceSync API"] = "TraceSync API"
    database: Literal["connected"] = "connected"
