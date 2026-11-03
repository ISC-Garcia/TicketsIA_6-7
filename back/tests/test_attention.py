import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Event, Ticket, User
from tests.conftest import NOW, auth_headers

RESOLUTION = {"solution": "Se reinició el nodo y se liberó el bloqueo.", "resolutionHours": 1.75}


def events_of(db: Session, ticket_id: str, type_: str) -> list[Event]:
    db.expire_all()
    return list(
        db.scalars(
            select(Event)
            .where(Event.ticket_id == ticket_id, Event.type == type_)
            .order_by(Event.id)
        )
    )


@pytest.fixture
def roberto(client: TestClient, demo: Session) -> dict[str, str]:
    return auth_headers(client, "tecnico")


def test_e4_01_atender_pasa_a_en_atencion_y_lo_registra(
    client: TestClient, roberto: dict[str, str], demo: Session
) -> None:
    response = client.post("/api/tickets/TCK-200003/attend", headers=roberto)

    assert response.status_code == 200
    assert response.json()["status"] == "En atención"
    [event] = events_of(demo, "TCK-200003", "Cambio de estado")
    assert (event.user_name, event.detail, event.time) == (
        "Roberto García Hernández",
        "Abierto a En atención",
        NOW,
    )


def test_e4_01_resolver_guarda_quien_cuando_y_la_solucion(
    client: TestClient, roberto: dict[str, str], demo: Session
) -> None:
    response = client.post("/api/tickets/TCK-200007/resolve", json=RESOLUTION, headers=roberto)

    ticket = response.json()
    assert response.status_code == 200
    assert ticket["status"] == "Resuelto"
    assert ticket["resolvedBy"] == "Roberto García Hernández"
    assert ticket["resolvedAt"] == "2026-10-28 11:42:10"
    assert ticket["resolutionHours"] == 1.75
    assert ticket["solution"] == RESOLUTION["solution"]
    [event] = events_of(demo, "TCK-200007", "Ticket resuelto")
    assert (event.detail, event.solution) == ("1.75 h", RESOLUTION["solution"])


@pytest.mark.parametrize(
    ("path", "ticket_id", "message"),
    [
        ("attend", "TCK-200007", "El ticket ya está en atención."),
        ("resolve", "TCK-200003", "Atiende el ticket antes de resolverlo."),
    ],
)
def test_e4_01_rechaza_transiciones_invalidas(
    client: TestClient, roberto: dict[str, str], path: str, ticket_id: str, message: str
) -> None:
    response = client.post(f"/api/tickets/{ticket_id}/{path}", json=RESOLUTION, headers=roberto)

    assert response.status_code == 409
    assert response.json() == {"detail": message}


def test_e4_01_un_resuelto_no_se_resuelve_otra_vez(
    client: TestClient, roberto: dict[str, str]
) -> None:
    client.post("/api/tickets/TCK-200007/resolve", json=RESOLUTION, headers=roberto)

    again = client.post("/api/tickets/TCK-200007/resolve", json=RESOLUTION, headers=roberto)
    attend = client.post("/api/tickets/TCK-200007/attend", headers=roberto)

    assert again.status_code == 409
    assert again.json() == {"detail": "El ticket ya está resuelto."}
    assert attend.json() == {"detail": "El ticket ya está resuelto."}


@pytest.mark.parametrize("path", ["attend", "resolve"])
def test_e4_01_solo_el_tecnico_asignado(client: TestClient, demo: Session, path: str) -> None:
    # TCK-200011 está asignado a Sarely.
    response = client.post(
        f"/api/tickets/TCK-200011/{path}", json=RESOLUTION, headers=auth_headers(client, "tecnico")
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": (
            "Solo el técnico asignado puede atender este ticket. "
            "Está asignado a Sarely Xala Hernández."
        )
    }


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"solution": "corta", "resolutionHours": 2}, "solution"),
        ({"solution": "           ", "resolutionHours": 2}, "solution"),
        ({"solution": RESOLUTION["solution"], "resolutionHours": 0}, "resolutionHours"),
        ({"solution": RESOLUTION["solution"], "resolutionHours": -1}, "resolutionHours"),
        ({"solution": RESOLUTION["solution"]}, "resolutionHours"),
    ],
)
def test_e4_01_valida_la_resolucion(
    client: TestClient, roberto: dict[str, str], body: dict, field: str
) -> None:
    response = client.post("/api/tickets/TCK-200007/resolve", json=body, headers=roberto)

    assert response.status_code == 422
    assert field in {error["field"] for error in response.json()["errors"]}


@pytest.mark.parametrize("path", ["attend", "resolve", "assign"])
def test_e4_01_un_ticket_inexistente_responde_404(
    client: TestClient, demo: Session, path: str
) -> None:
    username = "coordinador" if path == "assign" else "tecnico"
    body = {"technician": "sxala"} if path == "assign" else RESOLUTION

    response = client.post(
        f"/api/tickets/TCK-000000/{path}", json=body, headers=auth_headers(client, username)
    )

    assert response.status_code == 404


def test_e4_04_lista_los_tecnicos_activos_con_su_carga(client: TestClient, demo: Session) -> None:
    coordinator = auth_headers(client, "coordinador")

    before = client.get("/api/technicians", headers=coordinator).json()
    demo.scalars(select(User).where(User.username == "sxala")).one().active = False
    demo.commit()
    after = client.get("/api/technicians", headers=coordinator).json()

    assert before == [
        {"username": "tecnico", "name": "Roberto García Hernández", "openTickets": 3},
        {"username": "sxala", "name": "Sarely Xala Hernández", "openTickets": 5},
    ]
    assert after == [{"username": "tecnico", "name": "Roberto García Hernández", "openTickets": 3}]


def test_e4_04_un_tecnico_sin_tickets_tiene_carga_cero(client: TestClient, demo: Session) -> None:
    demo.add(User(username="nuevo", name="Ana Nueva", role="tecnico"))
    demo.commit()

    technicians = client.get("/api/technicians", headers=auth_headers(client, "coordinador")).json()

    assert {"username": "nuevo", "name": "Ana Nueva", "openTickets": 0} in technicians


def test_e4_04_reasignar_conserva_el_estado_y_lo_registra(
    client: TestClient, demo: Session
) -> None:
    response = client.post(
        "/api/tickets/TCK-200007/assign",
        json={"technician": "sxala"},
        headers=auth_headers(client, "coordinador"),
    )

    ticket = response.json()
    assert response.status_code == 200
    assert (ticket["technician"], ticket["technicianUsername"]) == (
        "Sarely Xala Hernández",
        "sxala",
    )
    assert ticket["status"] == "En atención"
    [event] = events_of(demo, "TCK-200007", "Reasignación")
    assert event.user_name == "Francisco Alejandro Parra Huerta"
    assert event.detail == "Roberto García Hernández a Sarely Xala Hernández"


def test_e4_04_el_nuevo_tecnico_puede_atender(client: TestClient, demo: Session) -> None:
    client.post(
        "/api/tickets/TCK-200003/assign",
        json={"technician": "sxala"},
        headers=auth_headers(client, "coordinador"),
    )

    previous = client.post(
        "/api/tickets/TCK-200003/attend", headers=auth_headers(client, "tecnico")
    )
    current = client.post("/api/tickets/TCK-200003/attend", headers=auth_headers(client, "sxala"))

    assert previous.status_code == 403
    assert current.json()["status"] == "En atención"


def test_e4_04_reasignar_un_historico_sin_tecnico(client: TestClient, demo: Session) -> None:
    ticket = demo.get(Ticket, "TCK-200025")
    assert ticket is not None
    ticket.technician_username = None
    demo.commit()

    client.post(
        "/api/tickets/TCK-200025/assign",
        json={"technician": "tecnico"},
        headers=auth_headers(client, "coordinador"),
    )

    [event] = events_of(demo, "TCK-200025", "Reasignación")
    assert event.detail == "Sin asignar a Roberto García Hernández"


@pytest.mark.parametrize(
    ("ticket_id", "technician", "code", "message"),
    [
        ("TCK-200007", "tecnico", 409, "El ticket ya está asignado a ese técnico."),
        ("TCK-200007", "coordinador", 422, "Elige un técnico activo."),
        ("TCK-200007", "nadie", 422, "Elige un técnico activo."),
        ("TCK-115796", "tecnico", 409, "Un ticket resuelto ya no se puede reasignar."),
    ],
)
def test_e4_04_rechaza_reasignaciones_invalidas(
    client: TestClient, demo: Session, ticket_id: str, technician: str, code: int, message: str
) -> None:
    response = client.post(
        f"/api/tickets/{ticket_id}/assign",
        json={"technician": technician},
        headers=auth_headers(client, "coordinador"),
    )

    assert response.status_code == code
    assert response.json() == {"detail": message}


def test_e4_04_no_reasigna_a_un_tecnico_desactivado(client: TestClient, demo: Session) -> None:
    demo.scalars(select(User).where(User.username == "sxala")).one().active = False
    demo.commit()

    response = client.post(
        "/api/tickets/TCK-200007/assign",
        json={"technician": "sxala"},
        headers=auth_headers(client, "coordinador"),
    )

    assert response.status_code == 422
