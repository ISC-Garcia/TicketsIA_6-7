from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query

from app.auth import require_roles
from app.config import SettingsDep
from app.db import DbDep
from app.schemas import Page
from app.services import events as service
from app.services.events import EventDate
from app.services.tickets import EventOut, event_out

router = APIRouter(prefix="/api/events", tags=["bitácora"])

PAGE_SIZE = 10
MAX_PAGE_SIZE = 100

# Los mismos de `front/src/types/event.ts`.
EventType = Literal[
    "Ticket creado",
    "Clasificado por IA",
    "Cambio de estado",
    "Ticket resuelto",
    "Reasignación",
    "Edición de datos",
    "Inicio de sesión",
    "Cierre de sesión",
    "Cambio de contraseña",
]


class EventPage(Page[EventOut]):
    # Para el conmutador "Solo ediciones posteriores al cierre": no depende de los filtros.
    after_close_total: int
    users: list[str]


@router.get("", dependencies=[Depends(require_roles("auditor"))], response_model_exclude_none=True)
def list_events(
    db: DbDep,
    settings: SettingsDep,
    type: EventType | None = None,
    user: Annotated[str | None, Query(max_length=120)] = None,
    date: EventDate | None = None,
    ticket_id: Annotated[str | None, Query(alias="ticketId", max_length=20)] = None,
    after_close: Annotated[bool, Query(alias="afterClose")] = False,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=MAX_PAGE_SIZE)] = PAGE_SIZE,
) -> EventPage:
    query = service.filtered(
        settings.now(),
        type=type,
        user=user,
        date=date,
        ticket_id=ticket_id,
        after_close=after_close,
    )
    items, total = service.list_events(db, query, page, page_size)
    return EventPage(
        items=[event_out(event, settings) for event in items],
        total=total,
        after_close_total=service.after_close_total(db),
        users=service.event_users(db),
    )
