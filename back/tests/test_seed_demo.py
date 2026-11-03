from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import cli
from app.config import Settings
from app.models import Event, Ticket, User
from app.seeds import local_time
from app.seeds.demo import seed_demo
from tests.conftest import NOW


def count(db: Session, model: type) -> int:
    return db.scalar(select(func.count()).select_from(model)) or 0


def test_e0_02_la_semilla_trae_los_datos_del_front(db: Session) -> None:
    seed_demo(db, NOW.tzinfo)  # pyright: ignore[reportArgumentType]

    assert count(db, User) == 4
    assert count(db, Ticket) == 9
    assert count(db, Event) == 31
    assert set(db.scalars(select(User.username))) == {"tecnico", "sxala", "coordinador", "auditor"}


def test_e0_02_la_semilla_conserva_ids_horas_y_responsables(db: Session) -> None:
    seed_demo(db, NOW.tzinfo)  # pyright: ignore[reportArgumentType]

    ticket = db.get(Ticket, "TCK-115796")
    assert ticket is not None
    assert ticket.technician_username == "sxala"
    assert ticket.resolved_by_username == "sxala"
    assert ticket.edited_after_close is True
    # 2025-12-09 04:12:45 en la Ciudad de México son las 10:12:45 UTC.
    assert ticket.resolved_at == datetime(2025, 12, 9, 10, 12, 45, tzinfo=UTC)

    edit = db.scalars(select(Event).where(Event.after_close)).one()
    assert edit.ticket_id == "TCK-115796"
    assert edit.changes == [
        {"field": "Tiempo de resolución", "oldValue": "10.25 h", "newValue": "2.00 h"}
    ]


def test_e0_02_los_eventos_quedan_en_orden_cronologico(db: Session) -> None:
    seed_demo(db, NOW.tzinfo)  # pyright: ignore[reportArgumentType]

    times = list(db.scalars(select(Event.time).order_by(Event.id)))
    assert times == sorted(times)


def test_e0_02_la_semilla_se_puede_repetir(db: Session) -> None:
    seed_demo(db, NOW.tzinfo)  # pyright: ignore[reportArgumentType]
    seed_demo(db, NOW.tzinfo)  # pyright: ignore[reportArgumentType]

    assert count(db, Ticket) == 9
    assert db.scalar(select(func.min(Event.id))) == 1


def test_e0_02_la_fecha_local_acepta_minutos_y_segundos() -> None:
    zone = NOW.tzinfo

    assert local_time("2026-10-28 09:57", zone).minute == 57  # pyright: ignore[reportArgumentType]
    assert local_time("2026-10-28 09:57:04", zone).second == 4  # pyright: ignore[reportArgumentType]
    with pytest.raises(ValueError, match="formato desconocido"):
        local_time("28/10/2026", zone)  # pyright: ignore[reportArgumentType]


def test_e0_02_el_comando_carga_la_semilla(
    db: Session, settings: Settings, capsys: pytest.CaptureFixture[str]
) -> None:
    cli.main(["seed", "demo"], settings)

    assert "Semilla demo cargada." in capsys.readouterr().out
    assert count(db, Ticket) == 9


def test_e0_02_el_comando_no_borra_datos_en_produccion(settings: Settings) -> None:
    production = settings.model_copy(update={"app_env": "production"})

    with pytest.raises(SystemExit, match="APP_ENV=production"):
        cli.main(["seed", "demo"], production)
