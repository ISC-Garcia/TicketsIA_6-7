from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.ml.model import load_model
from app.routers import health, model


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
    app.include_router(health.router)
    app.include_router(model.router)
    return app


app = create_app()
