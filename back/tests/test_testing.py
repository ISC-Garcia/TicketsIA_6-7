import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.main import create_app
from app.models import Event, Ticket, User
from app.routers import testing


def test_e0_07_reset_recarga_la_semilla_demo(client: TestClient, demo: Session) -> None:
    demo.delete(demo.get(Ticket, "TCK-200003"))
    demo.commit()

    response = client.post("/api/test/reset")

    demo.expire_all()
    assert response.status_code == 204
    assert demo.scalar(select(func.count()).select_from(Ticket)) == 9
    assert demo.scalar(select(func.count()).select_from(Event)) == 31


def test_e0_07_reset_no_existe_fuera_de_las_pruebas(settings: Settings) -> None:
    development = settings.model_copy(update={"app_env": "development"})

    with TestClient(create_app(development)) as client:
        assert client.post("/api/test/reset").status_code == 404


def test_e1_04_las_pruebas_pueden_desactivar_una_cuenta(client: TestClient, demo: Session) -> None:
    response = client.patch("/api/test/users/sxala", json={"active": False})

    demo.expire_all()
    assert response.status_code == 204
    assert demo.scalars(select(User.active).where(User.username == "sxala")).one() is False
    missing = client.patch("/api/test/users/nadie", json={"active": False})
    assert missing.status_code == 404


def test_e9_06_el_endpoint_de_pruebas_ejecuta_un_respaldo(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[Settings] = []
    monkeypatch.setattr(testing, "run_backup", lambda db, settings: calls.append(settings))

    response = client.post("/api/test/backup")

    assert response.status_code == 204
    assert len(calls) == 1


def test_e10_02_reset_limpia_los_intentos_fallidos(client: TestClient, demo: Session) -> None:
    for _ in range(5):
        client.post("/api/auth/login", json={"username": "tecnico", "password": "x"})

    client.post("/api/test/reset")

    response = client.post("/api/auth/login", json={"username": "tecnico", "password": "demo2026"})
    assert response.status_code == 200
