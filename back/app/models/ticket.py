from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.domain import AREAS, DEPARTMENTS, PRIORITIES, TICKET_STATUSES
from app.models.checks import one_of


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = (
        CheckConstraint(one_of("priority", PRIORITIES), name="prioridad_valida"),
        CheckConstraint(one_of("status", TICKET_STATUSES), name="estado_valido"),
        CheckConstraint(one_of("department", DEPARTMENTS), name="departamento_valido"),
        CheckConstraint(one_of("area", AREAS), name="area_valida"),
        Index("ix_tickets_bandeja", "status", "priority", "created_at"),
        Index("ix_tickets_department", "department"),
        Index("ix_tickets_created_at", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(10), primary_key=True)
    priority: Mapped[str] = mapped_column(String(10))
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
