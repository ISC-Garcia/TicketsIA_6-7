from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Ticket
from tests.conftest import auth_headers
from tests.factories import make_ticket

# Estas expectativas son las mismas que el front prueba contra los manejadores de MSW
# (front/src/services/__tests__/services.spec.ts): así los dos contratos no se separan.


@pytest.fixture
def tecnico(client: TestClient, demo: Session) -> dict[str, str]:
    return auth_headers(client, "tecnico")


def ids(client: TestClient, headers: dict[str, str], **params: Any) -> list[str]:
    response = client.get("/api/tickets", params=params, headers=headers)
    assert response.status_code == 200, response.text
    return [ticket["id"] for ticket in response.json()["items"]]


def total(client: TestClient, headers: dict[str, str], **params: Any) -> int:
    return client.get("/api/tickets", params=params, headers=headers).json()["total"]


def test_e2_01_ordena_por_prioridad_y_antiguedad_sin_resueltos(
    client: TestClient, tecnico: dict[str, str]
) -> None:
    assert ids(client, tecnico) == [
        "TCK-200007",
        "TCK-200003",
        "TCK-200014",
        "TCK-200011",
        "TCK-200021",
        "TCK-200018",
        "TCK-200029",
        "TCK-200025",
    ]


def test_e2_01_muestra_resueltos_solo_al_filtrar_por_ese_estado(
    client: TestClient, tecnico: dict[str, str]
) -> None:
    assert ids(client, tecnico, status="Resuelto") == ["TCK-115796"]


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"priority": "Crítica"}, 2),
        ({"department": "Seguridad Informática"}, 2),
        ({"status": "En atención"}, 2),
        ({"status": "Abierto"}, 6),
        ({"date": "hoy"}, 4),
        ({"date": "48"}, 7),
        ({"date": "7"}, 8),
        ({"search": "dead"}, 1),
        ({"search": " contabilidad "}, 3),
        ({"search": "tck-2000"}, 8),
        ({"search": "   "}, 8),
        ({"status": "Resuelto", "date": "7"}, 0),
    ],
)
def test_e2_01_filtra(
    client: TestClient, tecnico: dict[str, str], params: dict[str, str], expected: int
) -> None:
    assert total(client, tecnico, **params) == expected


def test_e2_01_combina_filtros_y_pagina(client: TestClient, tecnico: dict[str, str]) -> None:
    response = client.get(
        "/api/tickets", params={"priority": "Baja", "page": 2, "pageSize": 1}, headers=tecnico
    )

    assert response.json()["total"] == 2
    assert [ticket["id"] for ticket in response.json()["items"]] == ["TCK-200025"]


def test_e2_01_pagina_de_25_por_omision(
    client: TestClient, tecnico: dict[str, str], demo: Session
) -> None:
    demo.add_all(make_ticket(id=f"TCK-9{index:05d}") for index in range(30))
    demo.commit()

    first = client.get("/api/tickets", headers=tecnico).json()
    last = client.get("/api/tickets", params={"page": 2}, headers=tecnico).json()

    assert first["total"] == 38
    assert len(first["items"]) == 25
    assert len(last["items"]) == 13


@pytest.mark.parametrize(
    "params",
    [
        {"priority": "Urgente"},
        {"status": "En proceso"},
        {"department": "Mesa"},
        {"date": "30"},
        {"page": 0},
        {"pageSize": 101},
        {"search": "x" * 101},
    ],
)
def test_e2_01_rechaza_valores_desconocidos(
    client: TestClient, tecnico: dict[str, str], params: dict[str, Any]
) -> None:
    response = client.get("/api/tickets", params=params, headers=tecnico)

    assert response.status_code == 422
    assert response.json()["detail"] == "Revisa los datos enviados."


def test_e2_01_devuelve_el_contrato_del_front(client: TestClient, tecnico: dict[str, str]) -> None:
    ticket = client.get("/api/tickets", params={"search": "TCK-200003"}, headers=tecnico).json()[
        "items"
    ][0]

    assert ticket == {
        "id": "TCK-200003",
        "priority": "Crítica",
        "area": "Contabilidad",
        "device": "Servidor Ubuntu",
        "department": "Infraestructura Cloud",
        "status": "Abierto",
        "createdAt": "2026-10-28 09:57",
        "reporter": "Mariana López Ruiz",
        "technician": "Roberto García Hernández",
        "summary": "Servidor principal apagado sin acceso a la base de datos",
        "description": (
            "El servidor principal se apagó y nadie tiene acceso a la base de datos de "
            "contabilidad. Urgente."
        ),
        "highlights": ["servidor principal", "base de datos"],
        "analysis": {
            "confidence": 73,
            "probabilities": {"Crítica": 73, "Alta": 11, "Media": 15, "Baja": 1},
            "sentiment": "Negativo",
            "intent": "Reporte de incidente",
            "keywords": ["servidor", "principal", "acceso", "base", "datos", "contabilidad"],
            "devices": ["Servidor Ubuntu", "Base de datos"],
            "errorCodes": [],
        },
    }


def test_e2_01_un_historico_no_trae_tecnico_ni_analisis(
    client: TestClient, tecnico: dict[str, str], demo: Session
) -> None:
    demo.add(make_ticket(id="TCK-100001", status="Resuelto", resolution_hours=3.5))
    demo.commit()

    found = client.get(
        "/api/tickets", params={"status": "Resuelto", "search": "TCK-100001"}, headers=tecnico
    ).json()["items"][0]

    assert found["resolutionHours"] == 3.5
    assert "technician" not in found
    assert "analysis" not in found


def test_e2_01_cuenta_por_prioridad(client: TestClient, tecnico: dict[str, str]) -> None:
    active = client.get("/api/tickets/counts", headers=tecnico).json()
    resolved = client.get("/api/tickets/counts", params={"resolved": True}, headers=tecnico).json()

    assert active == {"Crítica": 2, "Alta": 2, "Media": 2, "Baja": 2}
    assert resolved == {"Crítica": 0, "Alta": 1, "Media": 0, "Baja": 0}


def test_e2_02_devuelve_el_detalle_resuelto_con_responsables(
    client: TestClient, demo: Session
) -> None:
    response = client.get("/api/tickets/tck-115796", headers=auth_headers(client, "auditor"))

    ticket = response.json()
    assert response.status_code == 200
    assert ticket["technician"] == "Sarely Xala Hernández"
    assert ticket["resolvedBy"] == "Sarely Xala Hernández"
    assert ticket["resolvedAt"] == "2025-12-09 04:12:45"
    assert ticket["resolutionHours"] == 2
    assert ticket["editedAfterClose"] is True
    assert ticket["solution"].startswith("Se reemplazó el módulo de energía")


def test_e2_02_un_ticket_abierto_omite_los_campos_de_resolucion(
    client: TestClient, tecnico: dict[str, str]
) -> None:
    ticket = client.get("/api/tickets/TCK-200007", headers=tecnico).json()

    assert {"resolvedAt", "resolvedBy", "solution", "editedAfterClose"}.isdisjoint(ticket)


@pytest.mark.parametrize("path", ["/api/tickets/TCK-000000", "/api/tickets/TCK-000000/events"])
def test_e2_02_avisa_si_el_ticket_no_existe(
    client: TestClient, tecnico: dict[str, str], path: str
) -> None:
    response = client.get(path, headers=tecnico)

    assert response.status_code == 404
    assert response.json() == {"detail": "Ticket no encontrado."}


def test_e2_02_devuelve_la_linea_de_tiempo_en_orden(
    client: TestClient, tecnico: dict[str, str]
) -> None:
    timeline = client.get("/api/tickets/TCK-115796/events", headers=tecnico).json()

    assert [event["type"] for event in timeline] == [
        "Ticket creado",
        "Clasificado por IA",
        "Cambio de estado",
        "Ticket resuelto",
        "Edición de datos",
    ]
    edit = timeline[-1]
    assert edit["id"].startswith("EV-")
    assert edit == {
        "id": edit["id"],
        "time": "2026-10-27 18:40:22",
        "user": "Francisco Alejandro Parra Huerta",
        "type": "Edición de datos",
        "ticketId": "TCK-115796",
        "detail": "tiempo de resolución 10.25 h a 2.00 h",
        "changes": [{"field": "Tiempo de resolución", "oldValue": "10.25 h", "newValue": "2.00 h"}],
        "afterClose": True,
    }
    resolved = timeline[3]
    assert resolved["solution"].startswith("Se reemplazó")
    assert "afterClose" not in resolved


def test_e2_01_filtro_de_hoy_usa_el_dia_local(
    client: TestClient, tecnico: dict[str, str], demo: Session
) -> None:
    # 2026-10-28 00:30 en la Ciudad de México ya es "hoy" aunque en UTC sea 06:30.
    ticket = demo.get(Ticket, "TCK-200029")
    assert ticket is not None
    ticket.created_at = ticket.created_at.replace(year=2026, month=10, day=28, hour=6, minute=30)
    demo.commit()

    assert "TCK-200029" in ids(client, tecnico, date="hoy")
