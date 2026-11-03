from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
import pytest
from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import FORBIDDEN, SESSION_EXPIRED, SESSION_REQUIRED, require_roles
from app.config import Settings
from app.main import create_app
from app.models import User
from app.security import ALGORITHM
from tests.conftest import auth_headers

PUBLIC = "público"
ANY_ROLE = ("tecnico", "coordinador", "auditor")
ROLE_USERS = {"tecnico": "tecnico", "coordinador": "coordinador", "auditor": "auditor"}

# Quién puede usar cada endpoint. Un endpoint nuevo sin fila aquí hace fallar la prueba.
PERMISSIONS: dict[tuple[str, str], str | tuple[str, ...]] = {
    ("GET", "/api/health"): PUBLIC,
    ("POST", "/api/auth/login"): PUBLIC,
    ("POST", "/api/auth/logout"): ANY_ROLE,
    ("GET", "/api/auth/me"): ANY_ROLE,
    ("GET", "/api/model/info"): ANY_ROLE,
    ("GET", "/api/tickets"): ("tecnico", "coordinador"),
    ("POST", "/api/tickets"): ("tecnico",),
    ("POST", "/api/tickets/analyze"): ("tecnico",),
    ("POST", "/api/tickets/{ticket_id}/attend"): ("tecnico",),
    ("POST", "/api/tickets/{ticket_id}/resolve"): ("tecnico",),
    ("POST", "/api/tickets/{ticket_id}/assign"): ("coordinador",),
    ("GET", "/api/technicians"): ("coordinador",),
    ("GET", "/api/tickets/counts"): ("tecnico", "coordinador"),
    ("GET", "/api/tickets/{ticket_id}"): ANY_ROLE,
    ("GET", "/api/tickets/{ticket_id}/events"): ANY_ROLE,
    # Solo existe con APP_ENV=test (ver test_testing.py).
    ("POST", "/api/test/reset"): PUBLIC,
    ("PATCH", "/api/test/users/{username}"): PUBLIC,
}


def api_routes(client: TestClient) -> set[tuple[str, str]]:
    paths = client.app.openapi()["paths"]  # pyright: ignore[reportAttributeAccessIssue]
    return {(method.upper(), path) for path, operations in paths.items() for method in operations}


def test_e1_02_cada_endpoint_tiene_permisos_declarados(client: TestClient) -> None:
    assert api_routes(client) == set(PERMISSIONS)


@pytest.mark.parametrize(("method", "path"), sorted(PERMISSIONS))
def test_e1_02_cada_endpoint_responde_segun_el_rol(
    client: TestClient, demo: Session, method: str, path: str
) -> None:
    allowed = PERMISSIONS[(method, path)]

    path = path.replace("{ticket_id}", "TCK-200003").replace("{username}", "auditor")
    anonymous = client.request(method, path)
    if allowed == PUBLIC:
        assert anonymous.status_code not in (401, 403)
        return
    assert anonymous.status_code == 401

    for role, username in ROLE_USERS.items():
        response = client.request(method, path, headers=auth_headers(client, username))
        if role in allowed:
            assert response.status_code not in (401, 403), (role, response.text)
        else:
            assert response.status_code == 403, role


def test_e1_02_sin_token_pide_iniciar_sesion(client: TestClient, demo: Session) -> None:
    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json() == {"detail": SESSION_REQUIRED}
    assert response.headers["www-authenticate"] == "Bearer"


def test_e1_02_un_token_alterado_no_sirve(client: TestClient, demo: Session) -> None:
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer no.es.valido"})

    assert response.status_code == 401
    assert response.json() == {"detail": SESSION_EXPIRED}


def test_e1_02_un_token_vencido_no_sirve(
    client: TestClient, demo: Session, settings: Settings
) -> None:
    past = datetime.now(UTC) - timedelta(hours=9)
    token = jwt.encode(
        {"sub": "tecnico", "iat": past, "exp": past + timedelta(hours=8)},
        settings.jwt_secret,
        algorithm=ALGORITHM,
    )

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_e1_02_desactivar_al_usuario_corta_su_sesion(client: TestClient, demo: Session) -> None:
    headers = auth_headers(client, "sxala")
    assert client.get("/api/auth/me", headers=headers).status_code == 200

    demo.scalars(select(User).where(User.username == "sxala")).one().active = False
    demo.commit()

    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_e1_02_un_rol_sin_permiso_recibe_403(settings: Settings, demo: Session) -> None:
    router = APIRouter()

    @router.get("/api/solo-coordinador")
    def only_coordinator(
        user: Annotated[User, Depends(require_roles("coordinador"))],
    ) -> dict[str, str]:
        return {"usuario": user.username}

    app = create_app(settings)
    app.include_router(router)
    with TestClient(app) as client:
        denied = client.get("/api/solo-coordinador", headers=auth_headers(client, "tecnico"))
        allowed = client.get("/api/solo-coordinador", headers=auth_headers(client, "coordinador"))

    assert denied.status_code == 403
    assert denied.json() == {"detail": FORBIDDEN}
    assert allowed.json() == {"usuario": "coordinador"}


def test_e1_02_un_error_interno_no_muestra_la_traza(settings: Settings) -> None:
    router = APIRouter()

    @router.get("/api/falla")
    def broken() -> None:
        raise RuntimeError("detalle interno secreto")

    app = create_app(settings)
    app.include_router(router)
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/api/falla")

    assert response.status_code == 500
    assert response.json() == {"detail": "Ocurrió un error en el servidor. Intenta de nuevo."}
    assert "secreto" not in response.text
