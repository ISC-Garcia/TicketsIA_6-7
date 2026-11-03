from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    Computed,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.domain import AREAS, DEPARTMENTS, PRIORITIES, TICKET_STATUSES
from app.models.checks import one_of

if TYPE_CHECKING:
    from app.models.user import User


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = (
        CheckConstraint(one_of("priority", PRIORITIES), name="prioridad_valida"),
        CheckConstraint(one_of("status", TICKET_STATUSES), name="estado_valido"),
        CheckConstraint(one_of("department", DEPARTMENTS), name="departamento_valido"),
        CheckConstraint(one_of("area", AREAS), name="area_valida"),
        # Orden de la bandeja: estado, urgencia y antigüedad, sin ordenar toda la tabla.
        Index("ix_tickets_bandeja", "status", "priority_rank", "created_at", "id"),
        # Búsqueda de texto de la bandeja con trigramas (migración 0003).
        Index(
            "ix_tickets_busqueda",
            text("((id || ' ' || summary || ' ' || description || ' ' || area)) gin_trgm_ops"),
            postgresql_using="gin",
        ),
        Index("ix_tickets_department", "department"),
        Index("ix_tickets_created_at", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(10), primary_key=True)
    priority: Mapped[str] = mapped_column(String(10))
    # 0 es la más urgente. La calcula PostgreSQL a partir de la prioridad.
    priority_rank: Mapped[int] = mapped_column(
        SmallInteger,
        Computed(
            "CASE priority WHEN 'Crítica' THEN 0 WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 ELSE 3 END",
            persisted=True,
        ),
    )
    area: Mapped[str] = mapped_column(String(40))
    device: Mapped[str] = mapped_column(String(80))
    department: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="Abierto")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reporter: Mapped[str] = mapped_column(String(120))
    technician_username: Mapped[str | None] = mapped_column(
        ForeignKey("users.username", onupdate="CASCADE")
    )
    summary: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    highlights: Mapped[list[str]] = mapped_column(JSONB, default=list)
    # Salida completa del análisis PNL y del modelo. Los tickets históricos no la tienen.
    analysis: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    resolution_hours: Mapped[float | None]
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by_username: Mapped[str | None] = mapped_column(
        ForeignKey("users.username", onupdate="CASCADE")
    )
    solution: Mapped[str | None] = mapped_column(Text)
    edited_after_close: Mapped[bool] = mapped_column(default=False)

    technician: Mapped["User | None"] = relationship(foreign_keys=[technician_username])
    resolved_by: Mapped["User | None"] = relationship(foreign_keys=[resolved_by_username])
