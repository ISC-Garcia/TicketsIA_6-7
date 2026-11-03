from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.ratelimit import MAX_FAILURES, WINDOW_SECONDS, LoginLimiter


def login(client: TestClient, username: str, password: str) -> int:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    return response.status_code


def test_e10_02_el_login_se_bloquea_tras_5_intentos_fallidos(
    client: TestClient, demo: Session
) -> None:
    for _ in range(MAX_FAILURES):
        assert login(client, "tecnico", "equivocada") == 401

    response = client.post("/api/auth/login", json={"username": "tecnico", "password": "demo2026"})

    assert response.status_code == 429
    assert response.json() == {
        "detail": "Demasiados intentos fallidos. Espera un minuto antes de volver a intentar."
    }
    assert 1 <= int(response.headers["Retry-After"]) <= WINDOW_SECONDS
    # Otra cuenta desde el mismo cliente no queda bloqueada.
    assert login(client, "coordinador", "demo2026") == 200


def test_e10_02_entrar_bien_reinicia_el_conteo(client: TestClient, demo: Session) -> None:
    for _ in range(MAX_FAILURES - 1):
        login(client, "tecnico", "equivocada")
    assert login(client, "tecnico", "demo2026") == 200

    for _ in range(MAX_FAILURES - 1):
        assert login(client, "tecnico", "equivocada") == 401


def test_e10_02_el_bloqueo_dura_un_minuto() -> None:
    now = [1000.0]
    limiter = LoginLimiter(clock=lambda: now[0])
    for _ in range(MAX_FAILURES):
        limiter.fail("cliente:tecnico")

    assert limiter.retry_after("cliente:tecnico") == WINDOW_SECONDS
    now[0] += WINDOW_SECONDS - 0.5
    assert limiter.retry_after("cliente:tecnico") == 1
    now[0] += 0.5
    assert limiter.retry_after("cliente:tecnico") == 0


def test_e10_02_las_respuestas_llevan_encabezados_de_seguridad(client: TestClient) -> None:
    headers = client.get("/api/health").headers

    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["Referrer-Policy"] == "no-referrer"
    assert headers["Content-Security-Policy"] == "default-src 'none'; frame-ancestors 'none'"


def test_e10_02_la_documentacion_puede_cargar_swagger(client: TestClient) -> None:
    response = client.get("/docs")

    assert response.status_code == 200
    assert "Content-Security-Policy" not in response.headers
    assert response.headers["X-Frame-Options"] == "DENY"


def test_e10_02_cors_solo_acepta_los_metodos_y_encabezados_que_usa_el_front(
    client: TestClient,
) -> None:
    allowed = client.options(
        "/api/tickets",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "PATCH",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    rejected = client.options(
        "/api/tickets",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "DELETE"},
    )
    stranger = client.options(
        "/api/tickets",
        headers={"Origin": "https://otro.example", "Access-Control-Request-Method": "GET"},
    )

    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert rejected.status_code == 400
    assert stranger.status_code == 400
