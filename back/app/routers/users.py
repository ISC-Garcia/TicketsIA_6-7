from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field, StringConstraints
from sqlalchemy import select

from app.auth import require_roles
from app.db import DbDep
from app.errors import FieldError
from app.models import User
from app.routers.auth import UserOut
from app.schemas import ApiModel
from app.security import hash_password

router = APIRouter(prefix="/api/users", tags=["usuarios"])

CoordinatorUser = Annotated[User, Depends(require_roles("coordinador"))]
USERNAME_PATTERN = r"^[a-z0-9._]{3,}$"


class NewUser(ApiModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    username: str = Field(pattern=USERNAME_PATTERN, max_length=50)
    role: Literal["tecnico", "coordinador", "auditor"]
    # Contraseña temporal: se pide cambiarla en el primer acceso (P-4).
    password: str = Field(min_length=8, max_length=200)


class UserState(ApiModel):
    active: bool


@router.get("", dependencies=[Depends(require_roles("coordinador"))])
def list_users(db: DbDep) -> list[UserOut]:
    return [UserOut.model_validate(user) for user in db.scalars(select(User).order_by(User.id))]


@router.post(
    "", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles("coordinador"))]
)
def create_user(body: NewUser, db: DbDep) -> UserOut:
    if db.scalar(select(User).where(User.username == body.username)):
        raise FieldError("username", "Ese usuario ya existe.")
    user = User(
        name=body.name,
        username=body.username,
        role=body.role,
        active=True,
        password_hash=hash_password(body.password),
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    return UserOut.model_validate(user)


@router.patch("/{username}")
def set_active(username: str, body: UserState, coordinator: CoordinatorUser, db: DbDep) -> UserOut:
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    # Desactivar la propia cuenta dejaría la mesa de ayuda sin quien la administre.
    if user.id == coordinator.id and not body.active:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="No puedes desactivar tu propia cuenta."
        )
    # Un usuario desactivado pierde la sesión en su siguiente petición (ver app.auth).
    user.active = body.active
    db.commit()
    return UserOut.model_validate(user)
