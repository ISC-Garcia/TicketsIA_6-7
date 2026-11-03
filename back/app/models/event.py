from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_time", "time"),
        Index("ix_events_ticket_id", "ticket_id"),
        Index("ix_events_type", "type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # Nombre visible de quien hizo la acción. Puede ser "Sistema", que no es un usuario.
    user_name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(40))
    ticket_id: Mapped[str | None] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"))
    detail: Mapped[str | None] = mapped_column(Text)
    changes: Mapped[list[dict[str, str]] | None] = mapped_column(JSONB)
    after_close: Mapped[bool] = mapped_column(default=False)
    solution: Mapped[str | None] = mapped_column(Text)
