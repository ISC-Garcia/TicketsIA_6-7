from fastapi import APIRouter, Depends

from app.auth import require_roles
from app.config import SettingsDep
from app.db import DbDep
from app.domain import PRIORITIES
from app.services import dashboard as service
from app.services.dashboard import Period
from app.services.tickets import ticket_out

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", dependencies=[Depends(require_roles("coordinador"))])
def dashboard(db: DbDep, settings: SettingsDep, period: Period = "mes") -> dict:
    by_priority = service.distribution(db, service.Ticket.priority, PRIORITIES)
    return {
        "kpis": service.kpis(db, settings.now()),
        "byPriority": by_priority,
        "total": sum(row["count"] for row in by_priority),
        "byDepartment": service.department_order(db),
        "trend": service.trend(db, settings, period),
        "resolutionVsSla": service.resolution_vs_sla(db),
        "critical": [
            ticket_out(ticket, settings).model_dump(by_alias=True, exclude_none=True)
            for ticket in service.critical_open(db)
        ],
    }
