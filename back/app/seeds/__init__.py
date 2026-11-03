from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import Base

TIME_FORMATS = ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M")


def local_time(value: str, zone: ZoneInfo) -> datetime:
    """Convierte una fecha sin zona de los datos fuente a la hora local de la mesa de ayuda."""
    for time_format in TIME_FORMATS:
        try:
            return datetime.strptime(value, time_format).replace(tzinfo=zone)
        except ValueError:
            continue
    raise ValueError(f"Fecha con formato desconocido: {value!r}")


# Las mediciones de PostgreSQL no son datos de la semilla: recargarla no las borra.
NOT_SEEDED = {"database_samples"}


def clear(session: Session) -> None:
    tables = ", ".join(
        table.name for table in Base.metadata.sorted_tables if table.name not in NOT_SEEDED
    )
    session.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


def sync_ticket_numbers(session: Session) -> None:
    """Deja la secuencia de IDs justo después del mayor ticket cargado."""
    session.execute(
        text(
            "SELECT setval('ticket_number_seq', "
            "GREATEST(200029, COALESCE(MAX(CAST(SUBSTRING(id FROM 5) AS INTEGER)), 0))) "
            "FROM tickets"
        )
    )
