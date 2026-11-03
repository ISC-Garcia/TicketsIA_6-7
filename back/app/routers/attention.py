from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field, StringConstraints

from app.auth import require_roles
from app.config import SettingsDep
from app.db import DbDep
from app.models import Ticket, User
from app.schemas import ApiModel
from app.services import attention
from app.services import tickets as service
from app.services.tickets import TicketOut

router = APIRouter(tags=["atención"])

TechnicianUser = Annotated[User, Depends(require_roles("tecnico"))]
CoordinatorUser = Annotated[User, Depends(require_roles("coordinador"))]


class Resolution(ApiModel):
    solution: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=10, max_length=2000)
    ]
    resolution_hours: float = Field(gt=0, le=10_000)


class Assignment(ApiModel):
    technician: str = Field(min_length=1, max_length=50)


class Technician(ApiModel):
    username: str
    name: str
    open_tickets: int


def load(db: DbDep, ticket_id: str) -> Ticket:
    ticket = service.get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado.")
    return ticket


def updated(db: DbDep, settings: SettingsDep, ticket: Ticket) -> TicketOut:
    db.refresh(ticket)
    fresh = service.get_ticket(db, ticket.id)
    assert fresh is not None
    return service.ticket_out(fresh, settings)


@router.post("/api/tickets/{ticket_id}/attend", response_model_exclude_none=True)
def attend(ticket_id: str, user: TechnicianUser, db: DbDep, settings: SettingsDep) -> TicketOut:
    ticket = load(db, ticket_id)
    attention.attend(db, settings, ticket, user)
    return updated(db, settings, ticket)


@router.post("/api/tickets/{ticket_id}/resolve", response_model_exclude_none=True)
def resolve(
    ticket_id: str, body: Resolution, user: TechnicianUser, db: DbDep, settings: SettingsDep
) -> TicketOut:
    ticket = load(db, ticket_id)
    attention.resolve(db, settings, ticket, user, body.solution, body.resolution_hours)
    return updated(db, settings, ticket)


@router.get("/api/technicians", dependencies=[Depends(require_roles("coordinador"))])
def technicians(db: DbDep) -> list[Technician]:
    return [
        Technician(username=user.username, name=user.name, open_tickets=total)
        for user, total in attention.active_technicians(db)
    ]


@router.post("/api/tickets/{ticket_id}/assign", response_model_exclude_none=True)
def assign(
    ticket_id: str, body: Assignment, user: CoordinatorUser, db: DbDep, settings: SettingsDep
) -> TicketOut:
    ticket = load(db, ticket_id)
    attention.assign(db, settings, ticket, user, body.technician)
    return updated(db, settings, ticket)
