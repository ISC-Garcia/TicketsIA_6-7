"""Ciclo de atención de un ticket: atender, resolver y reasignar.

Reglas (P-1, P-2, P-10): solo el técnico asignado atiende un ticket Abierto y resuelve uno
En atención; el coordinador reasigna mientras el ticket no esté resuelto.
"""

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.events import record_event
from app.models import Ticket, User

OPEN = "Abierto"
IN_PROGRESS = "En atención"
RESOLVED = "Resuelto"
UNASSIGNED = "Sin asignar"


def conflict(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, detail=detail)


def ensure_assigned(ticket: Ticket, user: User) -> None:
    if ticket.technician_username != user.username:
        owner = ticket.technician.name if ticket.technician else UNASSIGNED
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail=f"Solo el técnico asignado puede atender este ticket. Está asignado a {owner}.",
        )


def attend(db: Session, settings: Settings, ticket: Ticket, user: User) -> None:
    ensure_assigned(ticket, user)
    if ticket.status != OPEN:
        raise conflict(f"El ticket ya está {ticket.status.lower()}.")

    ticket.status = IN_PROGRESS
    record_event(
        db,
        settings,
        user_name=user.name,
        type="Cambio de estado",
        ticket_id=ticket.id,
        detail=f"{OPEN} a {IN_PROGRESS}",
    )
    db.commit()


def resolve(
    db: Session, settings: Settings, ticket: Ticket, user: User, solution: str, hours: float
) -> None:
    ensure_assigned(ticket, user)
    if ticket.status == RESOLVED:
        raise conflict("El ticket ya está resuelto.")
    if ticket.status != IN_PROGRESS:
        raise conflict("Atiende el ticket antes de resolverlo.")

    ticket.status = RESOLVED
    ticket.solution = solution
    ticket.resolution_hours = hours
    ticket.resolved_at = settings.now()
    ticket.resolved_by_username = user.username
    record_event(
        db,
        settings,
        user_name=user.name,
        type="Ticket resuelto",
        ticket_id=ticket.id,
        detail=f"{hours:.2f} h",
        solution=solution,
    )
    db.commit()


def active_technicians(db: Session) -> list[tuple[User, int]]:
    """Técnicos activos con su número de tickets sin resolver, para repartir la carga."""
    open_tickets = (
        select(Ticket.technician_username, func.count().label("total"))
        .where(Ticket.status != RESOLVED)
        .group_by(Ticket.technician_username)
        .subquery()
    )
    rows = db.execute(
        select(User, func.coalesce(open_tickets.c.total, 0))
        .outerjoin(open_tickets, open_tickets.c.technician_username == User.username)
        .where(User.role == "tecnico", User.active)
        .order_by(User.name)
    )
    return [(user, total) for user, total in rows]


def assign(
    db: Session, settings: Settings, ticket: Ticket, coordinator: User, username: str
) -> None:
    if ticket.status == RESOLVED:
        raise conflict("Un ticket resuelto ya no se puede reasignar.")
    technician = db.scalar(
        select(User).where(User.username == username, User.role == "tecnico", User.active)
    )
    if technician is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Elige un técnico activo."
        )
    if technician.username == ticket.technician_username:
        raise conflict("El ticket ya está asignado a ese técnico.")

    previous = ticket.technician.name if ticket.technician else UNASSIGNED
    ticket.technician_username = technician.username
    record_event(
        db,
        settings,
        user_name=coordinator.name,
        type="Reasignación",
        ticket_id=ticket.id,
        detail=f"{previous} a {technician.name}",
    )
    db.commit()


def format_hours(hours: float | None) -> str:
    return f"{hours:.2f} h" if hours is not None else "sin registro"


def correct_resolution(
    db: Session,
    settings: Settings,
    ticket: Ticket,
    user: User,
    solution: str | None,
    hours: float | None,
) -> None:
    """Corrige la solución o las horas de un ticket resuelto (P-3, P-8).

    Queda como "Edición de datos" posterior al cierre, que es lo que revisa el auditor.
    """
    if ticket.status != RESOLVED:
        raise conflict("Solo se puede corregir la resolución de un ticket resuelto.")
    if ticket.resolved_by_username != user.username:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Solo quien resolvió el ticket puede corregir su resolución.",
        )

    changes: list[dict[str, str]] = []
    details: list[str] = []
    if hours is not None and round(hours, 2) != round(ticket.resolution_hours or 0, 2):
        old, new = format_hours(ticket.resolution_hours), format_hours(hours)
        changes.append({"field": "Tiempo de resolución", "oldValue": old, "newValue": new})
        details.append(f"tiempo de resolución {old} a {new}")
        ticket.resolution_hours = hours
    if solution is not None and solution != (ticket.solution or ""):
        changes.append(
            {"field": "Solución aplicada", "oldValue": ticket.solution or "", "newValue": solution}
        )
        details.append("solución aplicada")
        ticket.solution = solution
    if not changes:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, detail="No hay cambios que guardar."
        )

    ticket.edited_after_close = True
    record_event(
        db,
        settings,
        user_name=user.name,
        type="Edición de datos",
        ticket_id=ticket.id,
        detail="; ".join(details),
        changes=changes,
        after_close=True,
    )
    db.commit()
