from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.errors import install_error_handlers
from app.ml.model import load_model
from app.routers import (
    attention,
    auth,
    dashboard,
    events,
    health,
    model,
    testing,
    tickets,
    users,
)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # El modelo se carga una sola vez; si falta, la API arranca y lo informa.
        app.state.model = load_model(settings.model_file)
        yield

    app = FastAPI(
        title="Sistema de Tickets de Soporte Técnico",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.dependency_overrides[get_settings] = lambda: settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
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
    if settings.app_env == "test":
        app.include_router(testing.router)
    return app


app = create_app()
