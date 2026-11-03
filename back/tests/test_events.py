from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Event
from tests.conftest import NOW, auth_headers

# Los 31 eventos de la semilla demo más el inicio de sesión del auditor en la prueba.
DEMO_EVENTS = 32


@pytest.fixture
def auditor(client: TestClient, demo: Session) -> dict[str, str]:
    return auth_headers(client, "auditor")


def events(client: TestClient, headers: dict[str, str], **params: object) -> dict:
    response = client.get("/api/events", params=params, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_e8_01_pagina_de_10_en_10_del_mas_reciente(
    client: TestClient, auditor: dict[str, str]
) -> None:
    first = events(client, auditor)
    third = events(client, auditor, page=4)

    assert first["total"] == DEMO_EVENTS
    assert len(first["items"]) == 10
    assert first["items"][0]["type"] == "Inicio de sesión"
    assert first["items"][0]["user"] == "Luis Daniel Morales Villarauz"
    assert first["items"][1]["time"] == "2026-10-28 10:14:08"
    times = [item["time"] for item in first["items"]]
    assert times == sorted(times, reverse=True)
    assert [item["ticketId"] for item in third["items"]] == ["TCK-115796", "TCK-115796"]


def test_e8_01_filtra_por_tipo_y_usuario(client: TestClient, auditor: dict[str, str]) -> None:
    body = events(client, auditor, type="Ticket creado", user="Sarely Xala Hernández")

    assert body["total"] == 5
    assert {item["type"] for item in body["items"]} == {"Ticket creado"}
    assert {item["user"] for item in body["items"]} == {"Sarely Xala Hernández"}


def test_e8_01_filtra_por_fecha_local(client: TestClient, auditor: dict[str, str]) -> None:
    today = events(client, auditor, date="hoy", pageSize=100)
    week = events(client, auditor, date="7", pageSize=100)

    assert today["total"] == 16
    assert all(item["time"].startswith("2026-10-28") for item in today["items"])
    # Hoy y los 6 días anteriores: deja fuera lo de diciembre de 2025.
    assert week["total"] == DEMO_EVENTS - 4


def test_e8_01_el_dia_empieza_a_medianoche_local(
    client: TestClient, auditor: dict[str, str], demo: Session
) -> None:
    # 23:59 del día anterior, hora local: no es de hoy aunque en UTC ya sea 28.
    demo.add(
        Event(
            time=NOW.replace(hour=0, minute=0) - timedelta(minutes=1),
            user_name="X",
            type="Inicio de sesión",
        )
    )
    demo.commit()

    body = events(client, auditor, date="hoy", user="X")

    assert body["total"] == 0


def test_e8_01_el_ticket_se_busca_por_id_exacto(
    client: TestClient, auditor: dict[str, str]
) -> None:
    exact = events(client, auditor, ticketId=" tck-115796 ")
    partial = events(client, auditor, ticketId="TCK-1")

    assert exact["total"] == 5
    assert {item["ticketId"] for item in exact["items"]} == {"TCK-115796"}
    assert partial["total"] == 0


def test_e8_01_solo_ediciones_posteriores_al_cierre(
    client: TestClient, auditor: dict[str, str]
) -> None:
    body = events(client, auditor, afterClose="true")

    assert body["total"] == 1
    edit = body["items"][0]
    assert edit["afterClose"] is True
    assert edit["changes"] == [
        {"field": "Tiempo de resolución", "oldValue": "10.25 h", "newValue": "2.00 h"}
    ]


def test_e8_01_el_conteo_y_los_usuarios_no_dependen_de_los_filtros(
    client: TestClient, auditor: dict[str, str]
) -> None:
    body = events(client, auditor, type="Cierre de sesión")

    assert body["afterCloseTotal"] == 1
    assert body["users"] == [
        "Francisco Alejandro Parra Huerta",
        "Luis Daniel Morales Villarauz",
        "Roberto García Hernández",
        "Sarely Xala Hernández",
        "Sistema",
    ]


@pytest.mark.parametrize(
    "params",
    [{"type": "Otro"}, {"date": "48"}, {"page": 0}, {"pageSize": 101}],
)
def test_e8_01_rechaza_filtros_invalidos(
    client: TestClient, auditor: dict[str, str], params: dict[str, object]
) -> None:
    response = client.get("/api/events", params=params, headers=auditor)

    assert response.status_code == 422
