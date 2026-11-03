from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth import require_roles
from app.config import SettingsDep
from app.db import DbDep
from app.schemas import Page
from app.services import tickets as service
from app.services.tickets import EventOut, TicketDate, TicketOut

router = APIRouter(prefix="/api/tickets", tags=["tickets"])

NOT_FOUND = "Ticket no encontrado."
MAX_PAGE_SIZE = 100

Priority = Literal["Crítica", "Alta", "Media", "Baja"]
Status = Literal["Abierto", "En atención", "Resuelto"]
Department = Literal[
    "Infraestructura Cloud",
    "Seguridad Informática",
    "Redes y Conectividad",
    "Hardware y Soporte Local",
    "Soporte de Aplicaciones",
]

# Las bandejas son del técnico y del coordinador; el detalle también lo consulta el auditor.
inbox_roles = Depends(require_roles("tecnico", "coordinador"))
detail_roles = Depends(require_roles("tecnico", "coordinador", "auditor"))


@router.get("", dependencies=[inbox_roles], response_model_exclude_none=True)
def list_tickets(
    db: DbDep,
    settings: SettingsDep,
    priority: Priority | None = None,
    department: Department | None = None,
    status: Status | None = None,
    date: TicketDate | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=MAX_PAGE_SIZE)] = 25,
) -> Page[TicketOut]:
    items, total = service.list_tickets(
        db,
        settings,
        page,
        page_size,
        priority=priority,
        department=department,
        status=status,
        date=date,
        search=search,
    )
    return Page(items=items, total=total)


@router.get("/counts", dependencies=[inbox_roles])
def count_tickets(db: DbDep, resolved: bool = False) -> dict[str, int]:
    return service.count_by_priority(db, resolved)


@router.get("/{ticket_id}", dependencies=[detail_roles], response_model_exclude_none=True)
def get_ticket(ticket_id: str, db: DbDep, settings: SettingsDep) -> TicketOut:
    ticket = service.get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return service.ticket_out(ticket, settings)


@router.get("/{ticket_id}/events", dependencies=[detail_roles], response_model_exclude_none=True)
def get_ticket_events(ticket_id: str, db: DbDep, settings: SettingsDep) -> list[EventOut]:
    ticket = service.get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return [service.event_out(event, settings) for event in service.ticket_events(db, ticket.id)]
