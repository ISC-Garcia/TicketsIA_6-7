import asyncio
import time
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.config import Settings
from app.main import create_app
from app.models import DatabaseSample
from app.services import monitoring
from tests.conftest import NOW, auth_headers


@pytest.fixture
def auditor(client: TestClient, demo: Session) -> dict[str, str]:
    return auth_headers(client, "auditor")


def status(client: TestClient, headers: dict[str, str], period: str = "24h") -> dict:
    response = client.get("/api/database/status", params={"period": period}, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def sample(db: Session, moment: datetime, transactions: int, connections: int = 4) -> None:
    db.add(
        DatabaseSample(
            time=moment, connections=connections, transactions=transactions, size_bytes=1
        )
    )
    db.commit()


def test_e9_01_los_indicadores_salen_del_servidor(
    client: TestClient, auditor: dict[str, str], db: Session
) -> None:
    body = status(client, auditor)

    size = db.scalar(text("SELECT pg_database_size(current_database())"))
    assert body["server"]["online"] is True
    assert body["server"]["version"].startswith("17")
    assert body["server"]["uptimeSeconds"] >= 0
    assert 1 <= body["connections"]["active"] <= body["connections"]["max"]
    assert body["latencyMs"] >= 0
    assert body["sizeBytes"] == pytest.approx(size, rel=0.05)
    assert 0 <= body["cacheHitRatio"] <= 100
    # Sin muestras no hay ritmo de consultas ni gráficas: no se inventan.
    assert "queriesPerMinute" not in body
    assert len(body["trend"]["labels"]) == 24
    assert set(body["trend"]["queriesPerHour"]) == {None}


def test_e9_01_el_ritmo_de_consultas_compara_contra_la_ultima_muestra(
    client: TestClient, auditor: dict[str, str], db: Session
) -> None:
    current = monitoring.snapshot(db)
    db.rollback()
    sample(db, monitoring.wall_clock(NOW.tzinfo) - timedelta(minutes=2), current.transactions - 200)  # pyright: ignore[reportArgumentType]

    body = status(client, auditor)

    # Unas 100 por minuto, más las pocas que hizo la propia prueba.
    assert 100 <= body["queriesPerMinute"] < 130


def test_e9_01_la_gráfica_promedia_las_muestras_de_cada_hora(db: Session) -> None:
    now = datetime(2026, 11, 3, 9, 30, tzinfo=NOW.tzinfo)
    # Dos muestras a las 08:00 y 08:05: 50 transacciones en 5 min son 600 por hora.
    sample(db, now.replace(hour=8, minute=0), 1_000, connections=2)
    sample(db, now.replace(hour=8, minute=5), 1_050, connections=6)
    # Un reinicio del servidor deja el contador más bajo: ese tramo no cuenta.
    sample(db, now.replace(hour=9, minute=0), 10, connections=3)

    trend = monitoring.series(db, "24h", now)

    assert trend["labels"][-2:] == ["08:00", "09:00"]
    assert trend["queriesPerHour"][-2:] == [600.0, None]
    assert trend["connections"][-2:] == [4.0, 3.0]
    assert trend["connections"][:-2] == [None] * 22


@pytest.mark.parametrize(
    ("period", "count", "first", "last"),
    [
        ("24h", 24, "10:00", "09:00"),
        ("semana", 7, "Mié 28", "Mar 3"),
        ("mes", 30, "5 Oct", "3 Nov"),
    ],
)
def test_e9_01_cada_periodo_tiene_sus_tramos(
    period: monitoring.MonitorPeriod, count: int, first: str, last: str
) -> None:
    cuts = monitoring.slots(period, datetime(2026, 11, 3, 9, 30, tzinfo=NOW.tzinfo))

    assert len(cuts) == count
    assert (cuts[0].label, cuts[-1].label) == (first, last)


def test_e9_01_las_consultas_lentas_salen_de_pg_stat_statements(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        monitoring,
        "SLOW_QUERIES",
        text(
            "SELECT 'SELECT *\n  FROM tickets' AS query, 7 AS calls, 12.345::float8 AS mean_exec_time"
        ),
    )

    assert monitoring.slow_queries(db) == [
        {"query": "SELECT * FROM tickets", "meanMs": 12.3, "calls": 7}
    ]


def test_e9_01_sin_pg_stat_statements_lo_informa_sin_fallar(
    client: TestClient, auditor: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(monitoring, "SLOW_QUERIES", text("SELECT * FROM no_existe"))

    body = status(client, auditor)

    assert body["slowQueries"] == {"available": False, "items": []}
    assert body["server"]["online"] is True


def test_e9_01_si_el_servidor_no_responde_lo_dice(
    client: TestClient, auditor: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    def offline(db: Session) -> monitoring.Snapshot:
        raise DBAPIError("SELECT", {}, Exception("sin conexión"))

    monkeypatch.setattr(monitoring, "snapshot", offline)

    body = status(client, auditor)

    assert body["server"] == {"online": False}
    assert "connections" not in body


def test_e9_01_un_periodo_desconocido_responde_422(
    client: TestClient, auditor: dict[str, str]
) -> None:
    response = client.get("/api/database/status", params={"period": "año"}, headers=auditor)

    assert response.status_code == 422


def test_e9_01_sin_lecturas_de_bloques_no_hay_porcentaje_de_cache() -> None:
    snapshot = monitoring.Snapshot(1, 100, 0, 0, 0, 1, NOW, "17")

    assert snapshot.cache_hit_ratio is None


def test_e9_01_la_api_guarda_una_muestra_al_arrancar(settings: Settings, db: Session) -> None:
    every_five = settings.model_copy(update={"monitor_interval_minutes": 5})

    with TestClient(create_app(every_five)):
        deadline = time.monotonic() + 5
        while not db.scalar(select(func.count()).select_from(DatabaseSample)):
            assert time.monotonic() < deadline, "la API no guardó la primera muestra"
            time.sleep(0.05)

    stored = db.scalars(select(DatabaseSample)).one()
    assert stored.connections >= 1
    assert stored.transactions > 0


def test_e9_01_una_muestra_fallida_no_detiene_el_muestreo(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    calls: list[str] = []

    def failing(engine: object, zone: object) -> None:
        calls.append("muestra")
        raise DBAPIError("INSERT", {}, Exception("sin conexión"))

    async def stop_after_two(seconds: float) -> None:
        if len(calls) == 2:
            raise asyncio.CancelledError
        assert seconds == 5 * 60

    monkeypatch.setattr(monitoring, "take_sample", failing)
    monkeypatch.setattr(monitoring.asyncio, "sleep", stop_after_two)

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(monitoring.sample_forever(None, NOW.tzinfo, 5))  # pyright: ignore[reportArgumentType]

    assert calls == ["muestra", "muestra"]
    assert "No se pudo guardar la muestra de PostgreSQL." in caplog.text
