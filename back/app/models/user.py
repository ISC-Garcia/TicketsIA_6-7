from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.domain import ROLES
from app.models.checks import one_of


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint(one_of("role", ROLES), name="role_valido"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(20))
    active: Mapped[bool] = mapped_column(default=True)
    # Hash argon2. Un usuario sin hash no puede iniciar sesión.
    password_hash: Mapped[str | None] = mapped_column(String(255))
    # Los usuarios que crea el coordinador entran con una contraseña temporal (P-4).
    must_change_password: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
