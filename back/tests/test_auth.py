from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Event, User
from app.security import (
    ALGORITHM,
    TokenClaims,
    create_token,
    hash_password,
    read_token,
    verify_password,
)
from tests.conftest import NOW, auth_headers

INVALID = "Usuario o contraseña incorrectos."


def events_of(db: Session, type_: str) -> list[Event]:
    db.expire_all()
    return list(db.scalars(select(Event).where(Event.type == type_).order_by(Event.id)))


@pytest.mark.parametrize(
    ("username", "role", "name"),
    [
        ("tecnico", "tecnico", "Roberto García Hernández"),
        ("sxala", "tecnico", "Sarely Xala Hernández"),
        ("coordinador", "coordinador", "Francisco Alejandro Parra Huerta"),
        ("auditor", "auditor", "Luis Daniel Morales Villarauz"),
    ],
)
def test_e1_01_cada_usuario_demo_entra_con_su_rol(
    client: TestClient, demo: Session, username: str, role: str, name: str
) -> None:
    response = client.post("/api/auth/login", json={"username": username, "password": "demo2026"})

    assert response.status_code == 200
    body = response.json()
    assert body["user"] == {
        "name": name,
        "username": username,
        "role": role,
        "active": True,
        "mustChangePassword": False,
    }
    assert isinstance(body["token"], str)


def test_e1_01_normaliza_el_usuario_pero_no_la_contrasena(
    client: TestClient, demo: Session
) -> None:
    ok = client.post("/api/auth/login", json={"username": "  TECNICO ", "password": "demo2026"})
    wrong = client.post("/api/auth/login", json={"username": "tecnico", "password": "DEMO2026"})

    assert ok.status_code == 200
    assert wrong.status_code == 401


def test_e1_01_el_login_queda_en_la_bitacora(client: TestClient, demo: Session) -> None:
    before = len(events_of(demo, "Inicio de sesión"))

    auth_headers(client, "coordinador")

    logins = events_of(demo, "Inicio de sesión")
    assert len(logins) == before + 1
    assert logins[-1].user_name == "Francisco Alejandro Parra Huerta"
    assert logins[-1].time == NOW


@pytest.mark.parametrize(
    ("username", "password"),
    [("tecnico", "incorrecta"), ("nadie", "demo2026"), ("sxala", "demo2026")],
)
def test_e1_01_rechaza_con_el_mismo_mensaje(
    client: TestClient, demo: Session, username: str, password: str
) -> None:
    sarely = demo.scalars(select(User).where(User.username == "sxala")).one()
    sarely.active = False
    demo.commit()
    before = len(events_of(demo, "Inicio de sesión"))

    response = client.post("/api/auth/login", json={"username": username, "password": password})

    assert response.status_code == 401
    assert response.json() == {"detail": INVALID}
    assert len(events_of(demo, "Inicio de sesión")) == before


def test_e1_01_un_usuario_sin_contrasena_no_entra(client: TestClient, demo: Session) -> None:
    demo.add(User(username="sinclave", name="Sin clave", role="auditor"))
    demo.commit()

    response = client.post("/api/auth/login", json={"username": "sinclave", "password": "x"})

    assert response.status_code == 401


def test_e1_01_valida_los_campos_en_espanol(client: TestClient, demo: Session) -> None:
    response = client.post("/api/auth/login", json={"username": ""})

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Revisa los datos enviados.",
        "errors": [
            {"field": "username", "message": "Este campo es obligatorio."},
            {"field": "password", "message": "Este campo es obligatorio."},
        ],
    }


def test_e1_01_cerrar_sesion_queda_en_la_bitacora(client: TestClient, demo: Session) -> None:
    headers = auth_headers(client, "auditor")
    before = len(events_of(demo, "Cierre de sesión"))

    response = client.post("/api/auth/logout", headers=headers)

    assert response.status_code == 204
    logouts = events_of(demo, "Cierre de sesión")
    assert len(logouts) == before + 1
    assert logouts[-1].user_name == "Luis Daniel Morales Villarauz"


def test_e1_01_me_devuelve_el_usuario_de_la_sesion(client: TestClient, demo: Session) -> None:
    response = client.get("/api/auth/me", headers=auth_headers(client, "sxala"))

    assert response.json()["name"] == "Sarely Xala Hernández"


def test_e1_01_las_contrasenas_se_guardan_con_argon2(demo: Session) -> None:
    stored = demo.scalars(select(User.password_hash).where(User.username == "tecnico")).one()

    assert stored is not None
    assert stored.startswith("$argon2")
    assert "demo2026" not in stored
    assert verify_password("demo2026", stored)
    assert not verify_password("otra", hash_password("demo2026"))
    assert not verify_password("demo2026", None)


def test_e1_01_el_token_vence_en_las_horas_configuradas(settings: Settings) -> None:
    token = create_token("tecnico", settings.jwt_secret, hours=8)
    claims = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])

    assert claims["sub"] == "tecnico"
    assert claims["exp"] - claims["iat"] == 8 * 3600
    assert read_token(token, settings.jwt_secret) == TokenClaims("tecnico", "session")
    assert claims["scope"] == "session"
    assert read_token(token, "otra-clave-de-al-menos-treinta-y-dos") is None


def test_e1_01_un_token_sin_usuario_no_sirve(settings: Settings) -> None:
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": 7, "exp": now + timedelta(hours=1)}, settings.jwt_secret, algorithm=ALGORITHM
    )

    assert read_token(token, settings.jwt_secret) is None
