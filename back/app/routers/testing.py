"""Endpoints de apoyo para las pruebas E2E. Solo se registran con APP_ENV=test."""

from fastapi import APIRouter, Response, status

from app.config import SettingsDep
from app.db import DbDep
from app.seeds.demo import seed_demo

router = APIRouter(prefix="/api/test", tags=["pruebas"])


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset(db: DbDep, settings: SettingsDep) -> Response:
    """Vuelve a cargar la semilla demo para que cada prueba E2E empiece del mismo estado."""
    seed_demo(db, settings.zone)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
