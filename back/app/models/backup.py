from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.checks import one_of

BACKUP_STATUSES = ("Exitoso", "Fallido")


class Backup(Base):
    """Un respaldo con `pg_dump` que se ejecutó de verdad, con éxito o con falla."""

    __tablename__ = "backups"
    __table_args__ = (
        CheckConstraint(one_of("status", BACKUP_STATUSES), name="estado_valido"),
        Index("ix_backups_started_at", "started_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[float]
    status: Mapped[str] = mapped_column(String(10))
    file_name: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    # SHA-256 del archivo, para comprobar después que nadie lo cambió (P-9).
    sha256: Mapped[str | None] = mapped_column(String(64))
    detail: Mapped[str | None] = mapped_column(Text)
    # El reintento apunta al respaldo fallido que repite.
    retry_of_id: Mapped[int | None] = mapped_column(ForeignKey("backups.id", ondelete="SET NULL"))
