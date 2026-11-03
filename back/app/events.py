from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Event


def record_event(
    db: Session,
    settings: Settings,
    *,
    user_name: str,
    type: str,
    ticket_id: str | None = None,
    detail: str | None = None,
    solution: str | None = None,
    changes: list[dict[str, str]] | None = None,
    after_close: bool = False,
) -> Event:
    """Agrega un evento a la bitácora. Quien llama decide cuándo confirmar la transacción."""
    event = Event(
        time=settings.now(),
        user_name=user_name,
        type=type,
        ticket_id=ticket_id,
        detail=detail,
        solution=solution,
        changes=changes,
        after_close=after_close,
    )
    db.add(event)
    return event
