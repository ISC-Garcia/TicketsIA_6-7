"""Consultas de la bitácora para el auditor (E8-01)."""

from datetime import datetime, timedelta
from typing import Literal

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models import Event

EventDate = Literal["hoy", "7"]
# "Últimos 7 días" es hoy y los 6 días anteriores completos, como en el prototipo.
WEEK_DAYS_BACK = 6


def date_floor(date: EventDate, now: datetime) -> datetime:
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return today if date == "hoy" else today - timedelta(days=WEEK_DAYS_BACK)


def filtered(
    now: datetime,
    *,
    type: str | None = None,
    user: str | None = None,
    date: EventDate | None = None,
    ticket_id: str | None = None,
    after_close: bool = False,
) -> Select[tuple[Event]]:
    query = select(Event)
    if type:
        query = query.where(Event.type == type)
    if user:
        query = query.where(Event.user_name == user)
    if date:
        query = query.where(Event.time >= date_floor(date, now))
    if ticket_id:
        # ID exacto: con un ID parcial, "TCK-1" traería miles de eventos (B-13).
        query = query.where(Event.ticket_id == ticket_id.strip().upper())
    if after_close:
        query = query.where(Event.after_close)
    return query


def list_events(
    db: Session, query: Select[tuple[Event]], page: int, page_size: int
) -> tuple[list[Event], int]:
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(
        query.order_by(Event.time.desc(), Event.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(items), total


def after_close_total(db: Session) -> int:
    return db.scalar(select(func.count()).where(Event.after_close)) or 0


def event_users(db: Session) -> list[str]:
    """Quienes aparecen en la bitácora, para el filtro de usuario."""
    return list(db.scalars(select(Event.user_name).distinct().order_by(Event.user_name)))
