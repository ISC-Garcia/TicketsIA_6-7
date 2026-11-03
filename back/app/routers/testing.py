"""Endpoints de apoyo para las pruebas E2E. Solo se registran con APP_ENV=test."""

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from app.config import SettingsDep
from app.db import DbDep
from app.models import User
from app.schemas import ApiModel
from app.seeds.demo import seed_demo

router = APIRouter(prefix="/api/test", tags=["pruebas"])


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset(db: DbDep, settings: SettingsDep) -> Response:
    """Vuelve a cargar la semilla demo para que cada prueba E2E empiece del mismo estado."""
    seed_demo(db, settings.zone)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class UserState(ApiModel):
    active: bool


@router.patch("/users/{username}", status_code=status.HTTP_204_NO_CONTENT)
def set_user_state(username: str, body: UserState, db: DbDep) -> Response:
    """Activa o desactiva una cuenta sin pasar por la pantalla de usuarios (llega en E5)."""
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    user.active = body.active
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
