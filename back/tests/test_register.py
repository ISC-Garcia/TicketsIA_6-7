from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Event, Ticket
from app.seeds.demo import seed_demo
from tests.conftest import NOW, auth_headers

DRAFT = {
    "area": "Operaciones",
    "reporter": "Jorge Méndez Castillo",
    "description": (
        "Caída total y pérdida de ping hacia el nodo principal del Cluster K8s con alerta "
        "DEADLOCK_DB. Esto detiene la facturación y la operación de toda la empresa."
    ),
}


def tickets_in(db: Session) -> int:
    db.expire_all()
    return db.scalar(select(func.count()).select_from(Ticket)) or 0


def test_e3_03_analiza_sin_guardar(model_client: TestClient, demo: Session) -> None:
    headers = auth_headers(model_client, "tecnico")
    before = tickets_in(demo)

    response = model_client.post("/api/tickets/analyze", json=DRAFT, headers=headers)

    body = response.json()
    assert response.status_code == 200
    assert body["priority"] == "Crítica"
    assert body["device"] == "Cluster K8s"
    assert body["deviceDetected"] is True
    assert body["highlights"] == ["Cluster K8s", "DEADLOCK_DB"]
    assert sum(body["analysis"]["probabilities"].values()) == 100
    assert body["analysis"]["confidence"] == body["analysis"]["probabilities"]["Crítica"]
    assert tickets_in(demo) == before


def test_e3_03_registra_con_id_nuevo_tecnico_de_la_sesion_y_eventos(
    model_client: TestClient, demo: Session
) -> None:
    headers = auth_headers(model_client, "sxala")

    first = model_client.post("/api/tickets", json=DRAFT, headers=headers)
    second = model_client.post(
        "/api/tickets", json=DRAFT | {"device": "Servidor Web"}, headers=headers
    )

    ticket = first.json()
    assert first.status_code == 201
    assert ticket["id"] == "TCK-200030"
    assert second.json()["id"] == "TCK-200031"
    assert second.json()["device"] == "Servidor Web"
    assert ticket["status"] == "Abierto"
    assert ticket["technician"] == "Sarely Xala Hernández"
    assert ticket["reporter"] == "Jorge Méndez Castillo"
    assert ticket["createdAt"] == "2026-10-28 11:42"
    assert ticket["summary"].endswith("…")
    assert ticket["analysis"]["errorCodes"] == ["DEADLOCK_DB"]

    demo.expire_all()
    events = list(
        demo.scalars(select(Event).where(Event.ticket_id == "TCK-200030").order_by(Event.id))
    )
    assert [(event.type, event.user_name) for event in events] == [
        ("Ticket creado", "Sarely Xala Hernández"),
        ("Clasificado por IA", "Sistema"),
    ]
    assert events[0].detail == "Reportado por Jorge Méndez Castillo, área Operaciones"
    assert events[1].detail.startswith(f"Prioridad {ticket['priority']} (")
    assert all(event.time == NOW for event in events)


def test_e3_03_el_registro_aparece_en_la_bandeja(model_client: TestClient, demo: Session) -> None:
    headers = auth_headers(model_client, "tecnico")
    created = model_client.post("/api/tickets", json=DRAFT, headers=headers).json()

    inbox = model_client.get("/api/tickets", params={"search": created["id"]}, headers=headers)

    assert [item["id"] for item in inbox.json()["items"]] == [created["id"]]


def test_e3_03_la_semilla_reinicia_la_numeracion(model_client: TestClient, demo: Session) -> None:
    headers = auth_headers(model_client, "tecnico")
    model_client.post("/api/tickets", json=DRAFT, headers=headers)

    seed_demo(demo, NOW.tzinfo)  # pyright: ignore[reportArgumentType]
    headers = auth_headers(model_client, "tecnico")
    again = model_client.post("/api/tickets", json=DRAFT, headers=headers)

    assert again.json()["id"] == "TCK-200030"


@pytest.mark.parametrize(
    ("changes", "field", "message"),
    [
        ({"area": "Marketing"}, "area", "El valor no está permitido."),
        ({"reporter": "   "}, "reporter", "Este campo es obligatorio."),
        ({"description": "   corto   "}, "description", "Debe tener al menos 20 caracteres."),
        ({"description": "x" * 1001}, "description", "Debe tener como máximo 1000 caracteres."),
        ({"device": "d" * 81}, "device", "Debe tener como máximo 80 caracteres."),
    ],
)
@pytest.mark.parametrize("path", ["/api/tickets/analyze", "/api/tickets"])
def test_e3_03_valida_la_captura(
    model_client: TestClient,
    demo: Session,
    path: str,
    changes: dict[str, Any],
    field: str,
    message: str,
) -> None:
    response = model_client.post(
        path, json=DRAFT | changes, headers=auth_headers(model_client, "tecnico")
    )

    assert response.status_code == 422
    assert {"field": field, "message": message} in response.json()["errors"]


@pytest.mark.parametrize("path", ["/api/tickets/analyze", "/api/tickets"])
def test_e3_03_sin_modelo_responde_503(client: TestClient, demo: Session, path: str) -> None:
    response = client.post(path, json=DRAFT, headers=auth_headers(client, "tecnico"))

    assert response.status_code == 503
    assert response.json() == {
        "detail": "El modelo de clasificación no está disponible. Avisa al administrador."
    }
    assert tickets_in(demo) == 9


def test_e3_03_solo_el_tecnico_registra(model_client: TestClient, demo: Session) -> None:
    response = model_client.post(
        "/api/tickets", json=DRAFT, headers=auth_headers(model_client, "coordinador")
    )

    assert response.status_code == 403
