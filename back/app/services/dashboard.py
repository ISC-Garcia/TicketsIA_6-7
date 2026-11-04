"""Indicadores del dashboard del coordinador, calculados en la base (H-6).

El periodo solo cambia la tendencia (P-7). Los KPI comparan contra la ventana anterior:
abiertos y críticos contra hace 7 días; tiempo de resolución y SLA, últimos 30 días contra los
30 anteriores.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal

from sqlalchemy import ColumnElement, and_, case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.config import Settings
from app.domain import DEPARTMENTS, PRIORITIES, SLA_HOURS
from app.models import Ticket

Period = Literal["semana", "mes", "año"]
RESOLVED = "Resuelto"
WEEK = timedelta(days=7)
MONTH = timedelta(days=30)
CRITICAL_LIMIT = 20

WEEKDAYS = ("Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom")
MONTHS = ("Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic")
SUBTITLES = {
    "semana": "Última semana, por día",
    "mes": "Último mes, por semana",
    "año": "Último año, por mes",
}


@dataclass
class Bucket:
    start: datetime
    label: str


def buckets(period: Period, now: datetime) -> tuple[str, list[Bucket]]:
    """Unidad de `date_trunc` y los cortes del periodo, en hora local y sin zona."""
    today = now.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    if period == "semana":
        days = [today - timedelta(days=offset) for offset in range(6, -1, -1)]
        return "day", [Bucket(day, f"{WEEKDAYS[day.weekday()]} {day.day}") for day in days]
    if period == "mes":
        monday = today - timedelta(days=today.weekday())
        weeks = [monday - timedelta(weeks=offset) for offset in range(4, -1, -1)]
        return "week", [Bucket(week, f"S{week.isocalendar().week}") for week in weeks]
    months = []
    year, month = today.year, today.month
    for _ in range(12):
        months.append(datetime(year, month, 1))
        year, month = (year, month - 1) if month > 1 else (year - 1, 12)
    return "month", [Bucket(start, MONTHS[start.month - 1]) for start in reversed(months)]


def local(column: ColumnElement, settings: Settings) -> ColumnElement:
    return func.timezone(settings.timezone, column)


def counts_by_bucket(
    db: Session, settings: Settings, column: ColumnElement, unit: str, first: datetime
) -> dict[datetime, int]:
    slot = func.date_trunc(unit, local(column, settings))
    rows = db.execute(
        select(slot, func.count()).where(column.is_not(None), slot >= first).group_by(slot)
    )
    return {start: total for start, total in rows}


def trend(db: Session, settings: Settings, period: Period) -> dict:
    unit, cuts = buckets(period, settings.now())
    created = counts_by_bucket(db, settings, Ticket.created_at, unit, cuts[0].start)
    resolved = counts_by_bucket(db, settings, Ticket.resolved_at, unit, cuts[0].start)
    return {
        "period": period,
        "subtitle": SUBTITLES[period],
        "labels": [cut.label for cut in cuts],
        "created": [created.get(cut.start, 0) for cut in cuts],
        "resolved": [resolved.get(cut.start, 0) for cut in cuts],
    }


def open_at(moment: datetime) -> ColumnElement[bool]:
    """Tickets que estaban sin resolver en ese momento."""
    return and_(
        Ticket.created_at <= moment, or_(Ticket.resolved_at.is_(None), Ticket.resolved_at > moment)
    )


def within_sla() -> ColumnElement[bool]:
    return or_(
        *(
            and_(Ticket.priority == priority, Ticket.resolution_hours <= hours)
            for priority, hours in SLA_HOURS.items()
        )
    )


def resolution_window(
    db: Session, start: datetime, end: datetime
) -> tuple[float | None, float | None]:
    """Promedio de horas y porcentaje dentro del SLA de lo resuelto en la ventana."""
    in_window = and_(Ticket.resolved_at > start, Ticket.resolved_at <= end)
    average, compliance = db.execute(
        select(
            func.avg(Ticket.resolution_hours),
            func.avg(case((within_sla(), 100.0), else_=0.0)),
        ).where(in_window)
    ).one()
    rounded = lambda value: round(float(value), 1) if value is not None else None  # noqa: E731
    return rounded(average), rounded(compliance)


def kpis(db: Session, now: datetime) -> dict:
    def count(*conditions: ColumnElement[bool]) -> int:
        return db.scalar(select(func.count()).select_from(Ticket).where(*conditions)) or 0

    critical = Ticket.priority == "Crítica"
    average, compliance = resolution_window(db, now - MONTH, now)
    previous_average, previous_compliance = resolution_window(db, now - 2 * MONTH, now - MONTH)
    return {
        "openTickets": count(Ticket.status != RESOLVED),
        "openTicketsBefore": count(open_at(now - WEEK)),
        "criticalOpen": count(Ticket.status != RESOLVED, critical),
        "criticalOpenBefore": count(open_at(now - WEEK), critical),
        "averageResolutionHours": average,
        "averageResolutionHoursBefore": previous_average,
        "slaCompliance": compliance,
        "slaComplianceBefore": previous_compliance,
    }


def distribution(db: Session, column: ColumnElement, order: tuple[str, ...]) -> list[dict]:
    totals = dict(db.execute(select(column, func.count()).group_by(column)).all())
    return [{"label": label, "count": totals.get(label, 0)} for label in order]


def resolution_vs_sla(db: Session) -> list[dict]:
    averages = dict(
        db.execute(
            select(Ticket.priority, func.avg(Ticket.resolution_hours))
            .where(Ticket.resolution_hours.is_not(None))
            .group_by(Ticket.priority)
        ).all()
    )
    return [
        {
            "priority": priority,
            "averageHours": round(float(averages[priority]), 1) if priority in averages else None,
            "slaHours": SLA_HOURS[priority],
        }
        for priority in PRIORITIES
    ]


def critical_open(db: Session) -> list[Ticket]:
    return list(
        db.scalars(
            select(Ticket)
            .where(Ticket.status != RESOLVED, Ticket.priority == "Crítica")
            .options(selectinload(Ticket.technician))
            .order_by(Ticket.created_at)
            .limit(CRITICAL_LIMIT)
        )
    )


def department_order(db: Session) -> list[dict]:
    rows = distribution(db, Ticket.department, DEPARTMENTS)
    return sorted(rows, key=lambda row: -row["count"])
