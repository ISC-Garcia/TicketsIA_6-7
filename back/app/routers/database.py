from fastapi import APIRouter, Depends
from sqlalchemy.exc import DBAPIError

from app.auth import require_roles
from app.config import SettingsDep
from app.db import DbDep
from app.schemas import ApiModel
from app.services import monitoring as service
from app.services.monitoring import MonitorPeriod

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
