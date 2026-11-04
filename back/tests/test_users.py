import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User
from tests.conftest import auth_headers

NEW_USER = {
    "name": "  Ana López Ruiz  ",
    "username": "alopez",
    "role": "tecnico",
    "password": "temporal1",
}


@pytest.fixture
def coordinator(client: TestClient, demo: Session) -> dict[str, str]:
    return auth_headers(client, "coordinador")


def test_e5_01_lista_los_usuarios_en_orden_de_alta(
    client: TestClient, coordinator: dict[str, str]
) -> None:
    users = client.get("/api/users", headers=coordinator).json()

    assert [user["username"] for user in users] == ["tecnico", "sxala", "coordinador", "auditor"]
    assert users[0] == {
        "name": "Roberto García Hernández",
        "username": "tecnico",
        "role": "tecnico",
        "active": True,
        "mustChangePassword": False,
    }


def test_e5_01_crea_un_usuario_con_contrasena_temporal(
    client: TestClient, coordinator: dict[str, str], demo: Session
) -> None:
    response = client.post("/api/users", json=NEW_USER, headers=coordinator)

    assert response.status_code == 201
    assert response.json() == {
        "name": "Ana López Ruiz",
        "username": "alopez",
        "role": "tecnico",
        "active": True,
        "mustChangePassword": True,
    }
    stored = demo.scalars(select(User).where(User.username == "alopez")).one()
    assert stored.password_hash is not None
    assert stored.password_hash.startswith("$argon2")


def test_e5_01_un_usuario_repetido_es_un_error_del_campo(
    client: TestClient, coordinator: dict[str, str]
) -> None:
    response = client.post("/api/users", json=NEW_USER | {"username": "sxala"}, headers=coordinator)

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Revisa los datos enviados.",
        "errors": [{"field": "username", "message": "Ese usuario ya existe."}],
    }


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"name": "   "}, "name"),
        ({"username": "Ana"}, "username"),
        ({"username": "ab"}, "username"),
        ({"username": "ana lopez"}, "username"),
        ({"role": "administrador"}, "role"),
        ({"password": "corta"}, "password"),
    ],
)
def test_e5_01_valida_el_nuevo_usuario(
    client: TestClient, coordinator: dict[str, str], changes: dict, field: str
) -> None:
    response = client.post("/api/users", json=NEW_USER | changes, headers=coordinator)

    assert response.status_code == 422
    assert field in {error["field"] for error in response.json()["errors"]}


def test_e5_01_desactivar_corta_la_sesion_y_reactivar_la_devuelve(
    client: TestClient, coordinator: dict[str, str]
) -> None:
    sarely = auth_headers(client, "sxala")

    off = client.patch("/api/users/sxala", json={"active": False}, headers=coordinator)
    after_off = client.get("/api/auth/me", headers=sarely)
    login = client.post("/api/auth/login", json={"username": "sxala", "password": "demo2026"})
    on = client.patch("/api/users/sxala", json={"active": True}, headers=coordinator)

    assert off.json()["active"] is False
    assert after_off.status_code == 401
    assert login.status_code == 401
    assert on.json()["active"] is True
    assert client.get("/api/auth/me", headers=sarely).status_code == 200


def test_e5_01_desactivar_no_cambia_la_asignacion_de_sus_tickets(
    client: TestClient, coordinator: dict[str, str]
) -> None:
    client.patch("/api/users/sxala", json={"active": False}, headers=coordinator)

    ticket = client.get("/api/tickets/TCK-200011", headers=coordinator).json()

    assert ticket["technician"] == "Sarely Xala Hernández"


def test_e5_01_nadie_se_desactiva_a_si_mismo(
    client: TestClient, coordinator: dict[str, str]
) -> None:
    response = client.patch("/api/users/coordinador", json={"active": False}, headers=coordinator)

    assert response.status_code == 409
    assert response.json() == {"detail": "No puedes desactivar tu propia cuenta."}
    # Activarse a sí mismo no hace daño: la cuenta ya está activa.
    again = client.patch("/api/users/coordinador", json={"active": True}, headers=coordinator)
    assert again.status_code == 200


def test_e5_01_un_usuario_inexistente_responde_404(
    client: TestClient, coordinator: dict[str, str]
) -> None:
    response = client.patch("/api/users/nadie", json={"active": False}, headers=coordinator)

    assert response.status_code == 404
