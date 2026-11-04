from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Event, User
from app.security import ALGORITHM
from tests.conftest import NOW, auth_headers

TEMPORARY = "temporal1"


@pytest.fixture
def new_user(client: TestClient, demo: Session) -> dict[str, str]:
    """Una técnica creada por el coordinador, con su token de primer acceso."""
    client.post(
        "/api/users",
        json={"name": "Ana López", "username": "alopez", "role": "tecnico", "password": TEMPORARY},
        headers=auth_headers(client, "coordinador"),
    )
    login = client.post("/api/auth/login", json={"username": "alopez", "password": TEMPORARY})
    assert login.json()["user"]["mustChangePassword"] is True
    return {"Authorization": f"Bearer {login.json()['token']}"}


def change(client: TestClient, headers: dict[str, str], current: str, new: str):
    return client.post(
        "/api/auth/password",
        json={"currentPassword": current, "newPassword": new},
        headers=headers,
    )


def test_e5_03_el_token_del_primer_acceso_solo_sirve_para_cambiar_la_contrasena(
    client: TestClient, new_user: dict[str, str]
) -> None:
    blocked = client.get("/api/tickets", headers=new_user)

    assert blocked.status_code == 403
    assert blocked.json() == {"detail": "Cambia tu contraseña temporal para continuar."}
    assert client.get("/api/auth/me", headers=new_user).json()["mustChangePassword"] is True
    assert client.post("/api/auth/logout", headers=new_user).status_code == 204


def test_e5_03_cambiar_la_contrasena_entrega_una_sesion_completa(
    client: TestClient, new_user: dict[str, str], demo: Session
) -> None:
    response = change(client, new_user, TEMPORARY, "nueva-clave-1")

    body = response.json()
    assert response.status_code == 200
    assert body["user"]["mustChangePassword"] is False
    full = {"Authorization": f"Bearer {body['token']}"}
    assert client.get("/api/tickets", headers=full).status_code == 200
    # El token del primer acceso ya no sirve.
    assert client.get("/api/auth/me", headers=new_user).status_code == 401
    old = client.post("/api/auth/login", json={"username": "alopez", "password": TEMPORARY})
    assert old.status_code == 401
    fresh = client.post("/api/auth/login", json={"username": "alopez", "password": "nueva-clave-1"})
    assert fresh.json()["user"]["mustChangePassword"] is False

    demo.expire_all()
    event = demo.scalars(select(Event).where(Event.type == "Cambio de contraseña")).one()
    assert (event.user_name, event.time) == ("Ana López", NOW)


@pytest.mark.parametrize(
    ("current", "new", "field", "message"),
    [
        ("equivocada", "nueva-clave-1", "currentPassword", "La contraseña actual no es correcta."),
        (TEMPORARY, TEMPORARY, "newPassword", "Debe ser distinta de la actual."),
        (TEMPORARY, "corta", "newPassword", "Debe tener al menos 8 caracteres."),
    ],
)
def test_e5_03_valida_el_cambio(
    client: TestClient, new_user: dict[str, str], current: str, new: str, field: str, message: str
) -> None:
    response = change(client, new_user, current, new)

    assert response.status_code == 422
    assert {"field": field, "message": message} in response.json()["errors"]


def test_e5_03_un_usuario_con_sesion_completa_tambien_puede_cambiarla(
    client: TestClient, demo: Session
) -> None:
    response = change(client, auth_headers(client, "auditor"), "demo2026", "otra-clave-9")

    assert response.status_code == 200
    stored = demo.scalars(select(User).where(User.username == "auditor")).one()
    demo.refresh(stored)
    assert stored.must_change_password is False


def test_e5_03_un_token_con_alcance_desconocido_no_sirve(
    client: TestClient, demo: Session, settings: Settings
) -> None:
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": "tecnico", "scope": "todo", "exp": now + timedelta(hours=1)},
        settings.jwt_secret,
        algorithm=ALGORITHM,
    )

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
