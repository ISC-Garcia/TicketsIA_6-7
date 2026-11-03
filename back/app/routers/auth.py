from typing import Literal

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import Field
from sqlalchemy import select

from app.auth import CurrentUser
from app.config import SettingsDep
from app.db import DbDep
from app.events import record_event
from app.models import User
from app.schemas import ApiModel
from app.security import create_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["sesión"])

INVALID_CREDENTIALS = "Usuario o contraseña incorrectos."


class LoginRequest(ApiModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=200)


class UserOut(ApiModel):
    name: str
    username: str
    role: Literal["tecnico", "coordinador", "auditor"]
    active: bool
    must_change_password: bool = False


class LoginResponse(ApiModel):
    token: str
    user: UserOut


@router.post("/login")
def login(body: LoginRequest, db: DbDep, settings: SettingsDep) -> LoginResponse:
    username = body.username.strip().lower()
    user = db.scalar(select(User).where(User.username == username))

    # Usuario inexistente, desactivado o contraseña incorrecta: el mismo mensaje en los tres
    # casos, para no revelar qué cuentas existen.
    if user is None or not user.active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)

    record_event(db, settings, user_name=user.name, type="Inicio de sesión")
    db.commit()
    token = create_token(user.username, settings.jwt_secret, settings.session_hours)
    return LoginResponse(token=token, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: CurrentUser, db: DbDep, settings: SettingsDep) -> Response:
    record_event(db, settings, user_name=user.name, type="Cierre de sesión")
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
