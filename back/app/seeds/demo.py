"""Semilla `demo`: los usuarios, tickets y eventos de `front/src/mocks/`, con los mismos IDs.

`demo.json` se exportó de esos archivos, con fechas alrededor de `DATA_NOW`. Al cargarla, todas
las fechas se mueven para que ese momento sea la hora de carga: los tickets conservan su
antigüedad y su SLA. Con la hora fija de las pruebas no se mueven y las E2E ven los datos exactos.
"""

import json
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models import Event, Ticket, User
from app.security import hash_password
from app.seeds import clear, local_time, sync_ticket_numbers

DATA_FILE = Path(__file__).with_name("demo.json")
# Contraseña de las cuentas de demostración, la misma que muestran los accesos demo del login.
DEMO_PASSWORD = "demo2026"
# El "ahora" de los datos de demo.json, en hora local de la mesa de ayuda.
DATA_NOW = "2026-10-28 11:42:10"


def load_data() -> dict[str, list[dict[str, Any]]]:
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def shift_to(now: datetime, zone: ZoneInfo) -> timedelta:
    """Cuánto se mueven las fechas de demo.json, en minutos completos."""
    shift = now - local_time(DATA_NOW, zone)
    return timedelta(minutes=round(shift.total_seconds() / 60))


def seed_demo(session: Session, zone: ZoneInfo, now: datetime) -> None:
    data = load_data()
    clear(session)
    shift = shift_to(now, zone)

    # Se suma en UTC para que el tiempo transcurrido no cambie con el horario de verano.
    def moved(value: str) -> datetime:
        return (local_time(value, zone).astimezone(UTC) + shift).astimezone(zone)

    usernames = {user["name"]: user["username"] for user in data["users"]}
    password_hash = hash_password(DEMO_PASSWORD)
    session.add_all(
        User(
            username=user["username"],
            name=user["name"],
            role=user["role"],
            active=user["active"],
            password_hash=password_hash,
        )
        for user in data["users"]
    )
    session.flush()

    session.add_all(ticket_from(item, usernames, moved) for item in data["tickets"])
    session.flush()

    # Se insertan en orden cronológico para que el ID crezca con el tiempo.
    events = sorted(data["events"], key=lambda item: local_time(item["time"], zone))
    session.add_all(event_from(item, moved) for item in events)
    sync_ticket_numbers(session)
    session.commit()


def ticket_from(
    item: dict[str, Any], usernames: dict[str, str], moved: Callable[[str], datetime]
) -> Ticket:
    resolved_at = item.get("resolvedAt")
    resolved_by = item.get("resolvedBy")
    return Ticket(
        id=item["id"],
        priority=item["priority"],
        area=item["area"],
        device=item["device"],
        department=item["department"],
        status=item["status"],
        created_at=moved(item["createdAt"]),
        reporter=item["reporter"],
        technician_username=usernames[item["technician"]],
        summary=item["summary"],
        description=item["description"],
        highlights=item["highlights"],
        analysis=item["analysis"],
        resolution_hours=item.get("resolutionHours"),
        resolved_at=moved(resolved_at) if resolved_at else None,
        resolved_by_username=usernames[resolved_by] if resolved_by else None,
        solution=item.get("solution"),
        edited_after_close=item.get("editedAfterClose", False),
    )


def event_from(item: dict[str, Any], moved: Callable[[str], datetime]) -> Event:
    return Event(
        time=moved(item["time"]),
        user_name=item["user"],
        type=item["type"],
        ticket_id=item.get("ticketId"),
        detail=item.get("detail"),
        changes=item.get("changes"),
        after_close=item.get("afterClose", False),
        solution=item.get("solution"),
    )
