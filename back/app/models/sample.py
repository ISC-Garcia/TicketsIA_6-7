from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class DatabaseSample(Base):
    """Una medición de PostgreSQL. La API guarda una cada pocos minutos para las gráficas."""

    __tablename__ = "database_samples"
    __table_args__ = (Index("ix_database_samples_time", "time"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    connections: Mapped[int]
    # Transacciones confirmadas y revertidas desde que arrancó el servidor; el ritmo sale de la
    # diferencia entre dos muestras.
    transactions: Mapped[int] = mapped_column(BigInteger)
    size_bytes: Mapped[int] = mapped_column(BigInteger)
