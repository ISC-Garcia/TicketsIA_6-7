from datetime import datetime
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.config import BACK_DIR, Settings

SECRET = "s" * 32


def make(**values: object) -> Settings:
    return Settings(_env_file=None, **({"jwt_secret": SECRET} | values))  # pyright: ignore[reportCallIssue]


def test_e0_01_sin_database_url_no_arranca(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError, match="database_url"):
        make()


@pytest.mark.parametrize(
    "url",
    [
        "postgres://u:p@h:5432/db",
        "postgresql://u:p@h:5432/db",
        "postgresql+psycopg://u:p@h:5432/db",
    ],
)
def test_e0_01_la_url_siempre_usa_psycopg(url: str) -> None:
    settings = make(database_url=url, test_database_url=url)

    assert settings.database_url == "postgresql+psycopg://u:p@h:5432/db"
    assert settings.test_database_url == "postgresql+psycopg://u:p@h:5432/db"


def test_e0_01_las_rutas_apuntan_a_back_datos() -> None:
    settings = make(database_url="postgresql://u:p@h/db")

    assert settings.data_dir == BACK_DIR / "datos"
    assert settings.model_file == BACK_DIR / "datos" / "modelo_tickets.joblib"


def test_e0_01_las_rutas_se_cambian_por_variables(tmp_path: Path) -> None:
    settings = make(database_url="postgresql://u:p@h/db", model_path=tmp_path / "m.joblib")

    assert settings.model_file == tmp_path / "m.joblib"


def test_e0_01_app_now_fija_la_hora_de_las_pruebas() -> None:
    settings = make(
        database_url="postgresql://u:p@h/db",
        app_env="test",
        app_now="2026-10-28T11:42:10-06:00",
    )

    assert settings.now().isoformat() == "2026-10-28T11:42:10-06:00"


@pytest.mark.parametrize("app_env", ["development", "production"])
def test_e11_01_fuera_de_las_pruebas_no_hay_hora_fija(app_env: str) -> None:
    with pytest.raises(ValidationError, match="APP_NOW solo se permite con APP_ENV=test"):
        make(
            database_url="postgresql://u:p@h/db",
            app_env=app_env,
            app_now="2026-10-28T11:42:10-06:00",
        )


def test_e0_01_sin_app_now_usa_el_reloj_real_en_la_zona_configurada() -> None:
    settings = make(database_url="postgresql://u:p@h/db")
    before = datetime.now(settings.zone)

    now = settings.now()

    assert now.tzinfo == settings.zone
    assert (now - before).total_seconds() < 5


def test_e0_01_app_now_exige_zona_horaria() -> None:
    with pytest.raises(ValidationError, match="app_now"):
        make(database_url="postgresql://u:p@h/db", app_env="test", app_now="2026-10-28T11:42:10")


def test_e1_01_la_clave_de_sesion_es_obligatoria_y_larga(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET", raising=False)

    with pytest.raises(ValidationError, match="jwt_secret"):
        make(database_url="postgresql://u:p@h/db", jwt_secret="corta")
