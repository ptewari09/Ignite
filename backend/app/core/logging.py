"""Log request metadata; never log bodies, query strings or authorization headers."""

import logging
from time import perf_counter
from uuid import uuid4

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import API_PREFIX

logger = logging.getLogger("tracesync.requests")


class RequestLoggingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id
        started = perf_counter()
        status_code = 500

        async def send_response(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = list(message.get("headers", []))
                if not any(name.lower() == b"x-request-id" for name, _ in headers):
                    headers.append((b"x-request-id", request_id.encode("ascii")))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_response)
        finally:
            route = getattr(scope.get("route"), "path_format", "<unmatched>")
            # Included routers can expose the local template without its prefix.
            # Use only the known static prefix, never raw path parameter values.
            if (
                route != "<unmatched>"
                and scope.get("path", "").startswith(API_PREFIX + "/")
                and not route.startswith(API_PREFIX + "/")
            ):
                route = API_PREFIX + route
            logger.info(
                "request method=%s route=%s status=%s duration_ms=%.2f request_id=%s",
                scope["method"], route, status_code,
                (perf_counter() - started) * 1000, request_id,
            )
