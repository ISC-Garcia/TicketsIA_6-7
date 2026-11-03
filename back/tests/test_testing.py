from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.main import create_app
from app.models import Event, Ticket


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
