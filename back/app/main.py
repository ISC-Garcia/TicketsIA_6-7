import asyncio
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.db import get_engine
from app.errors import install_error_handlers
from app.ml.model import load_model
from app.ratelimit import LoginLimiter
from app.routers import (
    attention,
    auth,
    dashboard,
    database,
    events,
    health,
    model,
    testing,
    tickets,
    users,
)
from app.services.monitoring import sample_forever

# La API solo responde JSON: nada de sus respuestas debe ejecutarse ni mostrarse en un marco.
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-site",
}
API_CSP = "default-src 'none'; frame-ancestors 'none'"
DOCS_PATHS = ("/docs", "/redoc")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # El modelo se carga una sola vez; si falta, la API arranca y lo informa.
        app.state.model = load_model(settings.model_file)
        sampler = None
        if settings.monitor_interval_minutes:
            engine = get_engine(settings.database_url)
            sampler = asyncio.create_task(
                sample_forever(engine, settings.zone, settings.monitor_interval_minutes)
            )
        yield
        if sampler:
            sampler.cancel()

    app = FastAPI(
        title="Sistema de Tickets de Soporte Técnico",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.dependency_overrides[get_settings] = lambda: settings
    app.state.login_limiter = LoginLimiter()

    @app.middleware("http")
    async def security_headers(request: Request, call_next: Callable) -> Response:
        response: Response = await call_next(request)
        response.headers.update(SECURITY_HEADERS)
        # La documentación interactiva carga Swagger desde una CDN: no lleva la CSP estricta.
        if not request.url.path.startswith(DOCS_PATHS):
            response.headers["Content-Security-Policy"] = API_CSP
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Authorization", "Content-Type"],
    )
    install_error_handlers(app)
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(model.router)
    app.include_router(tickets.router)
    app.include_router(attention.router)
    app.include_router(dashboard.router)
    app.include_router(users.router)
    app.include_router(events.router)
    app.include_router(database.router)
    if settings.app_env == "test":
        app.include_router(testing.router)
    return app


app = create_app()
