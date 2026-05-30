# Mediflow — Production-Grade Middleware Stack
# Provides: structured JSON logging, request ID injection,
# response timing, standardized error format, and API versioning guard.

import time
import uuid
import logging
import traceback

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# ─── Structured Logger ─────────────────────────────────────────────────────────

class JsonFormatter(logging.Formatter):
    """Emit log records as single-line JSON for log aggregation (e.g. Datadog, GCP Logging)."""

    def format(self, record: logging.LogRecord) -> str:
        import json as _json
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "line": record.lineno,
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return _json.dumps(payload, ensure_ascii=False)


def setup_logging(level: str = "INFO") -> None:
    """Configure root logger with JSON formatter for production deployments."""
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Quiet noisy third-party loggers
    for noisy in ("uvicorn.access", "supabase", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


# ─── Request Context Middleware ────────────────────────────────────────────────

class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Injects a unique request ID header into every request and response.
    Adds response timing in X-Response-Time header.
    Emits structured access logs on completion.
    """

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        start_time = time.perf_counter()

        # Inject into request state for downstream handlers
        request.state.request_id = request_id

        try:
            response: Response = await call_next(request)
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logging.getLogger("mediflow.request").error(
                f"Unhandled exception during request processing",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "elapsed_ms": elapsed_ms,
                    "error": str(exc),
                    "traceback": traceback.format_exc()
                }
            )
            return JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": "INTERNAL_SERVER_ERROR",
                        "message": "An unexpected error occurred. Please try again.",
                        "request_id": request_id
                    }
                },
                headers={"X-Request-ID": request_id}
            )

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # Attach standard response headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{elapsed_ms}ms"

        # Structured access log (skip health checks to reduce noise)
        if request.url.path != "/health":
            logging.getLogger("mediflow.access").info(
                f"{request.method} {request.url.path} → {response.status_code} [{elapsed_ms}ms]",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "elapsed_ms": elapsed_ms,
                    "client_ip": request.client.host if request.client else "unknown",
                }
            )

        return response


# ─── API Version Guard Middleware ──────────────────────────────────────────────

class ApiVersionMiddleware(BaseHTTPMiddleware):
    """
    Warns callers using deprecated unversioned /api/ paths.
    New callers should use /api/v1/ prefix.
    Returns deprecation header but still routes normally for backward compat.
    """

    DEPRECATED_PREFIXES = [
        "/api/voice-scribe",
        "/api/ocr-scan",
        "/api/lab-trend",
        "/api/whatsapp-send",
        "/api/generate-seasonal-forecast",
        "/api/generate-consult-room",
    ]

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Add deprecation header for legacy paths
        for prefix in self.DEPRECATED_PREFIXES:
            if request.url.path == prefix:
                response.headers["Deprecation"] = "true"
                response.headers["Sunset"] = "2026-12-31"
                response.headers["Link"] = f'</api/v1{request.url.path[4:]}>; rel="successor-version"'
                break

        return response


# ─── Standardized Error Handlers ──────────────────────────────────────────────

def create_error_response(
    status_code: int,
    code: str,
    message: str,
    request_id: str | None = None,
    details: dict | None = None
) -> JSONResponse:
    """Create a standardized Mediflow API error response."""
    body: dict = {
        "error": {
            "code": code,
            "message": message,
        }
    }
    if request_id:
        body["error"]["request_id"] = request_id
    if details:
        body["error"]["details"] = details

    return JSONResponse(status_code=status_code, content=body)
