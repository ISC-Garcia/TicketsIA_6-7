"""Estado real de PostgreSQL para el auditor (E9-01, P-14).

Todo sale del propio servidor: `pg_stat_database`, `pg_stat_activity`, el catálogo y
`pg_stat_statements`. Las gráficas usan las muestras que guarda la API cada pocos minutos y
nunca rellenan huecos: un periodo sin muestras se ve vacío.

El monitoreo mide el servidor de verdad, así que usa el reloj del sistema aunque las pruebas
fijen la hora del negocio con `APP_NOW`.
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from itertools import pairwise
from typing import Literal
from zoneinfo import ZoneInfo

from sqlalchemy import Engine, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.models import DatabaseSample
from app.services.dashboard import MONTHS, WEEKDAYS

MonitorPeriod = Literal["24h", "semana", "mes"]
SUBTITLES = {
    "24h": "Últimas 24 horas, por hora",
    "semana": "Última semana, por día",
    "mes": "Último mes, por día",
}
LATENCY_PINGS = 3
SLOW_QUERY_LIMIT = 5
# Con menos tiempo entre dos lecturas el ritmo de consultas no es confiable.
MIN_RATE_SECONDS = 30

logger = logging.getLogger(__name__)

SNAPSHOT = text(
    """
    SELECT
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS connections,
        current_setting('max_connections')::int AS max_connections,
        xact_commit + xact_rollback AS transactions,
        blks_hit,
        blks_read,
        pg_database_size(current_database()) AS size_bytes,
        pg_postmaster_start_time() AS started_at,
        current_setting('server_version') AS version
    FROM pg_stat_database
    WHERE datname = current_database()
    """
)

# Se omiten las consultas del propio monitoreo y las de mantenimiento.
SLOW_QUERIES = text(
    """
    SELECT query, calls, mean_exec_time
    FROM pg_stat_statements
    WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND query !~* 'pg_stat|pg_database|pg_postmaster|pg_catalog|alembic_version'
      AND query !~* 'current_setting|current_schema'
      AND query ~* '^\\s*(select|insert|update|delete|with)'
    ORDER BY mean_exec_time DESC
    LIMIT :limit
    """
)


@dataclass
class Snapshot:
    connections: int
    max_connections: int
    transactions: int
    blks_hit: int
    blks_read: int
    size_bytes: int
    started_at: datetime
    version: str

    @property
    def cache_hit_ratio(self) -> float | None:
        reads = self.blks_hit + self.blks_read
        return round(self.blks_hit / reads * 100, 1) if reads else None


def wall_clock(zone: ZoneInfo) -> datetime:
    return datetime.now(zone)


def snapshot(db: Session) -> Snapshot:
    row = db.execute(SNAPSHOT).one()
    return Snapshot(**row._asdict())


def latency_ms(db: Session) -> float:
    """Promedio de ida y vuelta de una consulta mínima, visto desde la API."""
    started = time.perf_counter()
    for _ in range(LATENCY_PINGS):
        db.execute(text("SELECT 1"))
    return round((time.perf_counter() - started) / LATENCY_PINGS * 1000, 1)


def record_sample(db: Session, now: datetime) -> DatabaseSample:
    current = snapshot(db)
    sample = DatabaseSample(
        time=now,
        connections=current.connections,
        transactions=current.transactions,
        size_bytes=current.size_bytes,
    )
    db.add(sample)
    db.commit()
    return sample


def per_minute(newer_tx: int, newer: datetime, older_tx: int, older: datetime) -> float | None:
    seconds = (newer - older).total_seconds()
    # Un reinicio del servidor pone los contadores en cero.
    if seconds < MIN_RATE_SECONDS or newer_tx < older_tx:
        return None
    return round((newer_tx - older_tx) / seconds * 60, 1)


def queries_per_minute(db: Session, current: Snapshot, now: datetime) -> float | None:
    """Transacciones por minuto desde la muestra más reciente que tenga suficiente distancia."""
    sample = db.scalar(
        select(DatabaseSample)
        .where(DatabaseSample.time <= now - timedelta(seconds=MIN_RATE_SECONDS))
        .order_by(DatabaseSample.time.desc())
        .limit(1)
    )
    if sample is None:
        return None
    return per_minute(current.transactions, now, sample.transactions, sample.time)


@dataclass
class Slot:
    start: datetime
    end: datetime
    label: str


def slots(period: MonitorPeriod, now: datetime) -> list[Slot]:
    if period == "24h":
        hour = now.replace(minute=0, second=0, microsecond=0)
        starts = [hour - timedelta(hours=offset) for offset in range(23, -1, -1)]
        return [Slot(start, start + timedelta(hours=1), f"{start:%H}:00") for start in starts]
    days = 7 if period == "semana" else 30
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    starts = [today - timedelta(days=offset) for offset in range(days - 1, -1, -1)]
    if period == "semana":
        labels = [f"{WEEKDAYS[day.weekday()]} {day.day}" for day in starts]
    else:
        labels = [f"{day.day} {MONTHS[day.month - 1]}" for day in starts]
    return [
        Slot(start, start + timedelta(days=1), label)
        for start, label in zip(starts, labels, strict=True)
    ]


def average(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 1) if values else None


def series(db: Session, period: MonitorPeriod, now: datetime) -> dict:
    """Consultas por hora y conexiones promedio en cada tramo del periodo."""
    cuts = slots(period, now)
    samples = list(
        db.scalars(
            select(DatabaseSample)
            .where(DatabaseSample.time >= cuts[0].start - timedelta(hours=1))
            .order_by(DatabaseSample.time)
        )
    )
    rates: list[tuple[datetime, float]] = []
    for older, newer in pairwise(samples):
        rate = per_minute(newer.transactions, newer.time, older.transactions, older.time)
        if rate is not None:
            rates.append((newer.time, rate * 60))

    def inside(moment: datetime, slot: Slot) -> bool:
        return slot.start <= moment < slot.end

    return {
        "period": period,
        "subtitle": SUBTITLES[period],
        "labels": [cut.label for cut in cuts],
        "queriesPerHour": [
            average([rate for moment, rate in rates if inside(moment, cut)]) for cut in cuts
        ],
        "connections": [
            average([float(s.connections) for s in samples if inside(s.time, cut)]) for cut in cuts
        ],
    }


def slow_queries(db: Session) -> list[dict] | None:
    """Las consultas con mayor tiempo promedio, o None si `pg_stat_statements` no está activa."""
    try:
        with db.begin_nested():
            rows = db.execute(SLOW_QUERIES, {"limit": SLOW_QUERY_LIMIT}).all()
    except DBAPIError:
        return None
    return [
        {
            "query": " ".join(row.query.split()),
            "meanMs": round(row.mean_exec_time, 1),
            "calls": row.calls,
        }
        for row in rows
    ]


async def sample_forever(engine: Engine, zone: ZoneInfo, minutes: int) -> None:
    """Guarda una muestra al arrancar y luego una cada `minutes` minutos."""
    while True:
        try:
            await asyncio.to_thread(take_sample, engine, zone)
        except DBAPIError:
            logger.warning("No se pudo guardar la muestra de PostgreSQL.", exc_info=True)
        await asyncio.sleep(minutes * 60)


def take_sample(engine: Engine, zone: ZoneInfo) -> None:
    with Session(engine) as session:
        record_sample(session, wall_clock(zone))
