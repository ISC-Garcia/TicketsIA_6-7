"""Dependencias de sesión y permisos para los routers."""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select

from app.config import SettingsDep
from app.db import DbDep
from app.models import User
from app.security import read_token

SESSION_REQUIRED = "Inicia sesión para continuar."
SESSION_EXPIRED = "Tu sesión terminó. Vuelve a iniciar sesión."
FORBIDDEN = "Tu rol no tiene permiso para esta acción."

_bearer = HTTPBearer(auto_error=False)


def unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"}
    )


def current_user(
    db: DbDep,
    settings: SettingsDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise unauthorized(SESSION_REQUIRED)

    username = read_token(credentials.credentials, settings.jwt_secret)
    user = db.scalar(select(User).where(User.username == username)) if username else None
    # Un usuario desactivado pierde la sesión en su siguiente petición.
    if user is None or not user.active:
        raise unauthorized(SESSION_EXPIRED)
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def require_roles(*roles: str) -> Callable[[User], User]:
    def check(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail=FORBIDDEN)
        return user

    return check
