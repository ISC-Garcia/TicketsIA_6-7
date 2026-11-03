from fastapi import APIRouter, Depends
from sqlalchemy.exc import DBAPIError

from app.auth import require_roles
from app.config import SettingsDep
from app.db import DbDep
from app.integrity import verify_backup, verify_table
from app.models import Event, Ticket
from app.schemas import ApiModel
from app.services import monitoring as service
from app.services.backups import recent_backups
from app.services.monitoring import MonitorPeriod
from app.services.tables import list_tables

router = APIRouter(
    prefix="/api/database", tags=["monitoreo"], dependencies=[Depends(require_roles("auditor"))]
)


class ServerOut(ApiModel):
    online: bool
    version: str | None = None
    started_at: str | None = None
    uptime_seconds: int | None = None


class ConnectionsOut(ApiModel):
    active: int
    max: int


class SlowQueryOut(ApiModel):
    query: str
    mean_ms: float
    calls: int


class SlowQueriesOut(ApiModel):
    # False si pg_stat_statements no está activa en el servidor.
    available: bool
    items: list[SlowQueryOut]


class TrendOut(ApiModel):
    period: MonitorPeriod
    subtitle: str
    labels: list[str]
    queries_per_hour: list[float | None]
    connections: list[float | None]


class DatabaseStatus(ApiModel):
    checked_at: str
    server: ServerOut
    connections: ConnectionsOut | None = None
    latency_ms: float | None = None
    queries_per_minute: float | None = None
    size_bytes: int | None = None
    cache_hit_ratio: float | None = None
    trend: TrendOut | None = None
    slow_queries: SlowQueriesOut | None = None


@router.get("/status", response_model_exclude_none=True)
def database_status(
    db: DbDep, settings: SettingsDep, period: MonitorPeriod = "24h"
) -> DatabaseStatus:
    now = service.wall_clock(settings.zone)
    checked_at = settings.local(now)
    try:
        current = service.snapshot(db)
    except DBAPIError:
        return DatabaseStatus(checked_at=checked_at, server=ServerOut(online=False))

    slow = service.slow_queries(db)
    return DatabaseStatus(
        checked_at=checked_at,
        server=ServerOut(
            online=True,
            version=current.version,
            started_at=settings.local(current.started_at),
            uptime_seconds=int((now - current.started_at).total_seconds()),
        ),
        connections=ConnectionsOut(active=current.connections, max=current.max_connections),
        latency_ms=service.latency_ms(db),
        queries_per_minute=service.queries_per_minute(db, current, now),
        size_bytes=current.size_bytes,
        cache_hit_ratio=current.cache_hit_ratio,
        trend=TrendOut.model_validate(service.series(db, period, now)),
        slow_queries=SlowQueriesOut(available=slow is not None, items=slow or []),
    )


class ColumnOut(ApiModel):
    name: str
    type: str
    description: str | None = None


class TableOut(ApiModel):
    name: str
    description: str | None = None
    rows: int
    size_bytes: int
    # Fecha más reciente de sus datos; nula si la tabla está vacía.
    modified_at: str | None = None
    columns: list[ColumnOut]


@router.get("/tables", response_model_exclude_none=True)
def database_tables(db: DbDep, settings: SettingsDep) -> list[TableOut]:
    return [
        TableOut.model_validate(
            table
            | {
                "modified_at": settings.local(table["modified_at"])
                if table["modified_at"]
                else None
            }
        )
        for table in list_tables(db)
    ]


class BackupOut(ApiModel):
    id: int
    started_at: str
    duration_seconds: float
    status: str
    file_name: str
    size_bytes: int | None = None
    sha256: str | None = None
    detail: str | None = None
    retry_of_id: int | None = None


@router.get("/backups", response_model_exclude_none=True)
def database_backups(db: DbDep, settings: SettingsDep) -> list[BackupOut]:
    """Los respaldos de los últimos 7 días, del más reciente al más antiguo."""
    return [
        BackupOut(
            id=backup.id,
            started_at=settings.local(backup.started_at),
            duration_seconds=backup.duration_seconds,
            status=backup.status,
            file_name=backup.file_name,
            size_bytes=backup.size_bytes,
            sha256=backup.sha256,
            detail=backup.detail,
            retry_of_id=backup.retry_of_id,
        )
        for backup in recent_backups(db, service.wall_clock(settings.zone))
    ]


class TableIntegrity(ApiModel):
    name: str
    verified: int
    mismatched: int
    # Hasta 20 IDs de registros alterados; `mismatched` es el total.
    examples: list[str]


class BackupIntegrity(ApiModel):
    id: int
    file_name: str
    started_at: str
    result: str


class IntegrityReport(ApiModel):
    checked_at: str
    tables: list[TableIntegrity]
    backups: list[BackupIntegrity]


@router.get("/integrity")
def database_integrity(db: DbDep, settings: SettingsDep) -> IntegrityReport:
    """Recalcula la huella SHA-256 de tickets, eventos y respaldos exitosos (E9-05)."""
    now = service.wall_clock(settings.zone)
    successful = [backup for backup in recent_backups(db, now) if backup.status == "Exitoso"]
    return IntegrityReport(
        checked_at=settings.local(now),
        tables=[
            TableIntegrity.model_validate(verify_table(db, model)) for model in (Ticket, Event)
        ],
        backups=[
            BackupIntegrity(
                id=backup.id,
                file_name=backup.file_name,
                started_at=settings.local(backup.started_at),
                result=verify_backup(backup, settings.backup_folder),
            )
            for backup in successful
        ],
    )
