"""Semilla `completo`: la semilla demo más el histórico del dataset como tickets resueltos.

Cada fila del dataset trae su tiempo de resolución, así que se carga como resuelta y no como
abierta. Si un ID ya existe (la semilla demo o una fila repetida del CSV), se conserva el primero.
"""

import csv
from collections.abc import Iterator
from datetime import datetime, timedelta
from itertools import batched
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.integrity import HASH_COLUMN, digest, hashed_columns
from app.models import Ticket
from app.seeds import local_time, sync_ticket_numbers
from app.seeds.demo import seed_demo

DATASET_FILE = "tickets_soporte_procesado.csv"
# PostgreSQL acepta hasta 65,535 parámetros por consulta: 2,000 filas de 14 columnas caben.
BATCH_SIZE = 2000
MAX_PARAMETERS = 65_535
SUMMARY_LENGTH = 60
HISTORIC_REPORTER = "Sin registro"


class MissingDatasetError(Exception):
    def __init__(self, path: Path) -> None:
        super().__init__(
            f"No se encontró {path}. Genera el dataset con `uv run python -m app.ml.train` "
            "o copia el CSV procesado en esa carpeta."
        )


def summarize(description: str) -> str:
    if len(description) <= SUMMARY_LENGTH:
        return description
    cut = description[:SUMMARY_LENGTH].rsplit(" ", 1)[0]
    return cut.rstrip(" ,.;:") + "…"


TICKET_COLUMNS = hashed_columns(Ticket)


def historic_rows(path: Path, zone: ZoneInfo) -> Iterator[dict[str, Any]]:
    with path.open(encoding="utf-8", newline="") as file:
        for row in csv.DictReader(file):
            created_at = local_time(row["fecha_creacion"], zone)
            hours = float(row["tiempo_resolucion_horas"])
            ticket = {
                "id": row["id_ticket"],
                "priority": row["prioridad"],
                "area": row["area_solicitante"],
                "device": row["dispositivo_afectado"],
                "department": row["departamento_asignado"],
                "status": "Resuelto",
                "created_at": created_at,
                "reporter": HISTORIC_REPORTER,
                "summary": summarize(row["descripcion_problema"]),
                "description": row["descripcion_problema"],
                "highlights": [],
                "resolution_hours": hours,
                "resolved_at": created_at + timedelta(hours=hours),
                "edited_after_close": False,
            }
            # La inserción masiva no pasa por el ORM: la huella se calcula aquí, con la misma
            # función que usa la API.
            yield ticket | {HASH_COLUMN: digest(ticket, TICKET_COLUMNS)}


def seed_full(session: Session, zone: ZoneInfo, data_dir: Path, now: datetime) -> int:
    """Carga la semilla completa y devuelve cuántos tickets históricos se agregaron."""
    path = data_dir / DATASET_FILE
    if not path.exists():
        raise MissingDatasetError(path)

    seed_demo(session, zone, now)
    before = session.scalar(select(func.count()).select_from(Ticket)) or 0

    for batch in batched(historic_rows(path, zone), BATCH_SIZE, strict=False):
        session.execute(insert(Ticket).values(batch).on_conflict_do_nothing(index_elements=["id"]))
    sync_ticket_numbers(session)
    session.commit()

    after = session.scalar(select(func.count()).select_from(Ticket)) or 0
    return after - before
