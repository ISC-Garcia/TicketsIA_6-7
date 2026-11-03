"""Consultas de tickets y su historial, con la forma de los tipos `Ticket` y `AuditEvent`."""

from datetime import datetime, timedelta
from typing import Any, Literal

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload

from app.config import Settings
from app.domain import PRIORITIES
from app.models import Event, Ticket
from app.schemas import ApiModel

TicketDate = Literal["hoy", "48", "7"]
DATE_WINDOWS = {"48": timedelta(hours=48), "7": timedelta(days=7)}
RESOLVED = "Resuelto"

# Texto en el que busca la bandeja. Es la misma expresión del índice de trigramas de la
# migración 0003: si cambia aquí, hay que cambiar el índice.
SEARCH_TEXT = (
    Ticket.id + " " + Ticket.summary + " " + Ticket.description + " " + Ticket.area
).self_group()


class TicketOut(ApiModel):
    id: str
    priority: str
    area: str
    device: str
    department: str
    status: str
    created_at: str
    reporter: str
    # Los tickets históricos del dataset no tienen técnico ni análisis.
    technician: str | None = None
    summary: str
    description: str
    highlights: list[str]
    analysis: dict[str, Any] | None = None
    resolution_hours: float | None = None
    resolved_at: str | None = None
    resolved_by: str | None = None
    solution: str | None = None
    edited_after_close: bool | None = None


class EventOut(ApiModel):
    id: str
    time: str
    user: str
    type: str
    ticket_id: str | None = None
    detail: str | None = None
    changes: list[dict[str, str]] | None = None
    after_close: bool | None = None
    solution: str | None = None


def ticket_out(ticket: Ticket, settings: Settings) -> TicketOut:
    return TicketOut(
        id=ticket.id,
        priority=ticket.priority,
        area=ticket.area,
        device=ticket.device,
        department=ticket.department,
        status=ticket.status,
        created_at=settings.local(ticket.created_at, seconds=False),
        reporter=ticket.reporter,
        technician=ticket.technician.name if ticket.technician else None,
        summary=ticket.summary,
        description=ticket.description,
        highlights=ticket.highlights,
        analysis=ticket.analysis,
        resolution_hours=ticket.resolution_hours,
        resolved_at=settings.local(ticket.resolved_at) if ticket.resolved_at else None,
        resolved_by=ticket.resolved_by.name if ticket.resolved_by else None,
        solution=ticket.solution,
        edited_after_close=ticket.edited_after_close or None,
    )


def event_out(event: Event, settings: Settings) -> EventOut:
    return EventOut(
        id=f"EV-{event.id}",
        time=settings.local(event.time),
        user=event.user_name,
        type=event.type,
        ticket_id=event.ticket_id,
        detail=event.detail,
        changes=event.changes,
        after_close=event.after_close or None,
        solution=event.solution,
    )


def date_floor(date: TicketDate, now: datetime) -> datetime:
    if date == "hoy":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    return now - DATE_WINDOWS[date]


def filtered(
    settings: Settings,
    *,
    priority: str | None = None,
    department: str | None = None,
    status: str | None = None,
    date: TicketDate | None = None,
    search: str | None = None,
) -> Select[tuple[Ticket]]:
    query = select(Ticket)
    # Los resueltos solo aparecen al pedirlos, como en la bandeja del prototipo.
    query = query.where(Ticket.status == status if status else Ticket.status != RESOLVED)
    if priority:
        query = query.where(Ticket.priority == priority)
    if department:
        query = query.where(Ticket.department == department)
    if date:
        query = query.where(Ticket.created_at >= date_floor(date, settings.now()))
    term = (search or "").strip()
    if term:
        query = query.where(SEARCH_TEXT.ilike(f"%{term}%"))
    return query


def list_tickets(
    db: Session, settings: Settings, page: int, page_size: int, **filters: Any
) -> tuple[list[TicketOut], int]:
    query = filtered(settings, **filters)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.options(selectinload(Ticket.technician), selectinload(Ticket.resolved_by))
        .order_by(Ticket.priority_rank, Ticket.created_at, Ticket.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return [ticket_out(ticket, settings) for ticket in rows], total


def count_by_priority(db: Session, resolved: bool) -> dict[str, int]:
    """Conteos de las pestañas de prioridad. Ignoran los demás filtros, como en el prototipo."""
    status_filter = Ticket.status == RESOLVED if resolved else Ticket.status != RESOLVED
    rows = db.execute(
        select(Ticket.priority, func.count()).where(status_filter).group_by(Ticket.priority)
    )
    counts = dict.fromkeys(PRIORITIES, 0)
    counts.update({priority: total for priority, total in rows})
    return counts


def get_ticket(db: Session, ticket_id: str) -> Ticket | None:
    return db.scalar(
        select(Ticket)
        .where(Ticket.id == ticket_id.strip().upper())
        .options(selectinload(Ticket.technician), selectinload(Ticket.resolved_by))
    )


def ticket_events(db: Session, ticket_id: str) -> list[Event]:
    return list(
        db.scalars(select(Event).where(Event.ticket_id == ticket_id).order_by(Event.time, Event.id))
    )
