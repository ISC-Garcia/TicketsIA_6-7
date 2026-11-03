"""Endpoints de apoyo para las pruebas E2E. Solo se registran con APP_ENV=test."""

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select, text

from app.config import SettingsDep
from app.db import DbDep
from app.models import User
from app.schemas import ApiModel
from app.seeds.demo import seed_demo
from app.services.backups import run_backup

router = APIRouter(prefix="/api/test", tags=["pruebas"])


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset(db: DbDep, settings: SettingsDep) -> Response:
    """Vuelve a cargar la semilla demo para que cada prueba E2E empiece del mismo estado."""
    seed_demo(db, settings.zone, settings.now())
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


@router.post("/tamper/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def tamper_ticket(ticket_id: str, db: DbDep) -> Response:
    """Cambia un ticket directo en la base, sin pasar por la API, para probar la integridad."""
    changed = db.execute(
        text("UPDATE tickets SET resolution_hours = 0.5 WHERE id = :id"), {"id": ticket_id}
    )
    if not changed.rowcount:  # pyright: ignore[reportAttributeAccessIssue]
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado.")
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/backup", status_code=status.HTTP_204_NO_CONTENT)
def backup(db: DbDep, settings: SettingsDep) -> Response:
    """Ejecuta un respaldo real, como `app.cli backup`, para que la E2E lo vea en la lista."""
    run_backup(db, settings)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
