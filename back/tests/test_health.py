from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_e0_01_health_responde_con_la_base_y_la_hora_fija(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": True,
        "modelLoaded": False,
        "now": "2026-10-28T11:42:10-06:00",
    }


def test_e0_01_health_avisa_si_la_base_no_responde(settings: Settings) -> None:
    broken = settings.model_copy(
        update={"database_url": "postgresql+psycopg://nadie:nada@127.0.0.1:1/ninguna"}
    )

    with TestClient(create_app(broken)) as client:
        body = client.get("/api/health").json()

    assert body["status"] == "degradado"
    assert body["database"] is False


def test_e0_01_cors_solo_acepta_el_origen_configurado(client: TestClient) -> None:
    allowed = client.options(
        "/api/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    denied = client.options(
        "/api/health",
        headers={"Origin": "http://otro-sitio.com", "Access-Control-Request-Method": "GET"},
    )

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in denied.headers
