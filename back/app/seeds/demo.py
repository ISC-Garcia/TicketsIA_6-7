"""Semilla `demo`: los usuarios, tickets y eventos de `front/src/mocks/`, con los mismos IDs.

`demo.json` se exportó de esos archivos. Las pruebas E2E dependen de estos datos exactos.
"""

import json
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models import Event, Ticket, User
from app.seeds import clear, local_time

DATA_FILE = Path(__file__).with_name("demo.json")


def load_data() -> dict[str, list[dict[str, Any]]]:
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def seed_demo(session: Session, zone: ZoneInfo) -> None:
    data = load_data()
    clear(session)

    usernames = {user["name"]: user["username"] for user in data["users"]}
    session.add_all(
        User(username=user["username"], name=user["name"], role=user["role"], active=user["active"])
        for user in data["users"]
    )
    session.flush()

    session.add_all(ticket_from(item, usernames, zone) for item in data["tickets"])
    session.flush()

    # Se insertan en orden cronológico para que el ID crezca con el tiempo.
    events = sorted(data["events"], key=lambda item: local_time(item["time"], zone))
    session.add_all(event_from(item, zone) for item in events)
    session.commit()


def ticket_from(item: dict[str, Any], usernames: dict[str, str], zone: ZoneInfo) -> Ticket:
    resolved_at = item.get("resolvedAt")
    resolved_by = item.get("resolvedBy")
    return Ticket(
        id=item["id"],
        priority=item["priority"],
        area=item["area"],
        device=item["device"],
        department=item["department"],
        status=item["status"],
        created_at=local_time(item["createdAt"], zone),
        reporter=item["reporter"],
        technician_username=usernames[item["technician"]],
        summary=item["summary"],
        description=item["description"],
        highlights=item["highlights"],
        analysis=item["analysis"],
        resolution_hours=item.get("resolutionHours"),
        resolved_at=local_time(resolved_at, zone) if resolved_at else None,
        resolved_by_username=usernames[resolved_by] if resolved_by else None,
        solution=item.get("solution"),
        edited_after_close=item.get("editedAfterClose", False),
    )


def event_from(item: dict[str, Any], zone: ZoneInfo) -> Event:
    return Event(
        time=local_time(item["time"], zone),
        user_name=item["user"],
        type=item["type"],
        ticket_id=item.get("ticketId"),
        detail=item.get("detail"),
        changes=item.get("changes"),
        after_close=item.get("afterClose", False),
        solution=item.get("solution"),
    )
