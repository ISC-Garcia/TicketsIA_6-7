from typing import Literal

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import Field
from sqlalchemy import select

from app.auth import SessionUser
from app.config import SettingsDep
from app.db import DbDep
from app.errors import FieldError
from app.events import record_event
from app.models import User
from app.schemas import ApiModel
from app.security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["sesión"])

INVALID_CREDENTIALS = "Usuario o contraseña incorrectos."
TOO_MANY_ATTEMPTS = "Demasiados intentos fallidos. Espera un minuto antes de volver a intentar."


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
def login(request: Request, body: LoginRequest, db: DbDep, settings: SettingsDep) -> LoginResponse:
    username = body.username.strip().lower()
    limiter = request.app.state.login_limiter
    client = request.client.host if request.client else "desconocido"
    key = f"{client}:{username}"
    wait = limiter.retry_after(key)
    if wait:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail=TOO_MANY_ATTEMPTS,
            headers={"Retry-After": str(wait)},
        )

    user = db.scalar(select(User).where(User.username == username))
    # Usuario inexistente, desactivado o contraseña incorrecta: el mismo mensaje en los tres
    # casos, para no revelar qué cuentas existen.
    if user is None or not user.active or not verify_password(body.password, user.password_hash):
        limiter.fail(key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)

    limiter.reset(key)

    record_event(db, settings, user_name=user.name, type="Inicio de sesión")
    db.commit()
    scope = "password" if user.must_change_password else "session"
    token = create_token(user.username, settings.jwt_secret, settings.session_hours, scope)
    return LoginResponse(token=token, user=UserOut.model_validate(user))


class PasswordChange(ApiModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=200)


@router.post("/password")
def change_password(
    body: PasswordChange, user: SessionUser, db: DbDep, settings: SettingsDep
) -> LoginResponse:
    """Cambia la contraseña y entrega una sesión completa (P-4)."""
    if not verify_password(body.current_password, user.password_hash):
        raise FieldError("currentPassword", "La contraseña actual no es correcta.")
    if body.new_password == body.current_password:
        raise FieldError("newPassword", "Debe ser distinta de la actual.")

    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    record_event(db, settings, user_name=user.name, type="Cambio de contraseña")
    db.commit()
    token = create_token(user.username, settings.jwt_secret, settings.session_hours)
    return LoginResponse(token=token, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: SessionUser, db: DbDep, settings: SettingsDep) -> Response:
    record_event(db, settings, user_name=user.name, type="Cierre de sesión")
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me")
def me(user: SessionUser) -> UserOut:
    return UserOut.model_validate(user)
