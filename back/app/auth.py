"""Dependencias de sesión y permisos para los routers."""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select

from app.config import SettingsDep
from app.db import DbDep
from app.models import User
from app.security import Scope, read_token

SESSION_REQUIRED = "Inicia sesión para continuar."
SESSION_EXPIRED = "Tu sesión terminó. Vuelve a iniciar sesión."
PASSWORD_CHANGE_REQUIRED = "Cambia tu contraseña temporal para continuar."
FORBIDDEN = "Tu rol no tiene permiso para esta acción."

_bearer = HTTPBearer(auto_error=False)


def unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"}
    )


def session(
    db: DbDep,
    settings: SettingsDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> tuple[User, Scope]:
    """El usuario de la sesión y el alcance de su token."""
    if credentials is None:
        raise unauthorized(SESSION_REQUIRED)

    claims = read_token(credentials.credentials, settings.jwt_secret)
    user = db.scalar(select(User).where(User.username == claims.username)) if claims else None
    # Un usuario desactivado pierde la sesión en su siguiente petición.
    if claims is None or user is None or not user.active:
        raise unauthorized(SESSION_EXPIRED)
    # Si ya cambió la contraseña, el token del primer acceso deja de servir.
    if claims.scope == "password" and not user.must_change_password:
        raise unauthorized(SESSION_EXPIRED)
    return user, claims.scope


SessionDep = Annotated[tuple[User, Scope], Depends(session)]


def session_user(current: SessionDep) -> User:
    """Cualquier sesión válida, incluida la que solo sirve para cambiar la contraseña."""
    return current[0]


def current_user(current: SessionDep) -> User:
    """Una sesión completa: con la contraseña temporal pendiente, solo puede cambiarla."""
    user, scope = current
    if scope == "password":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=PASSWORD_CHANGE_REQUIRED)
    return user


CurrentUser = Annotated[User, Depends(current_user)]
SessionUser = Annotated[User, Depends(session_user)]


def require_roles(*roles: str) -> Callable[[User], User]:
    def check(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail=FORBIDDEN)
        return user

    return check
