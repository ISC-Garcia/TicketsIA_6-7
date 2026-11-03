from collections.abc import Iterator
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session

from app.config import BACK_DIR, Settings
from app.db import get_engine
from app.main import create_app
from app.ml.train import run
from app.seeds import clear

SMALL_DATASET = 2000
NOW = datetime(2026, 10, 28, 11, 42, 10, tzinfo=ZoneInfo("America/Mexico_City"))


@pytest.fixture(scope="session")
def settings(tmp_path_factory: pytest.TempPathFactory) -> Settings:
    base = Settings()  # pyright: ignore[reportCallIssue]
    if not base.test_database_url:
        pytest.exit("Falta TEST_DATABASE_URL: las pruebas nunca usan la base de desarrollo.")
    if base.test_database_url == base.database_url:
        pytest.exit("TEST_DATABASE_URL debe apuntar a una base distinta de DATABASE_URL.")

    # Sin modelo por omisión: cada prueba que lo necesita entrena uno pequeño.
    data_dir = tmp_path_factory.mktemp("datos")
    return base.model_copy(
        update={
            "app_env": "test",
            "database_url": base.test_database_url,
            "app_now": NOW,
            "data_dir": data_dir,
            "model_path": None,
        }
    )


@pytest.fixture(scope="session")
def trained(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Carpeta con un modelo entrenado con 2,000 registros, compartido por las pruebas."""
    folder = tmp_path_factory.mktemp("modelo")
    run(folder, records=SMALL_DATASET)
    return folder


@pytest.fixture(scope="session")
def migrated(settings: Settings) -> Engine:
    """Deja la base de pruebas vacía y con el esquema de la última migración."""
    engine = get_engine(settings.database_url)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))

    config = Config(BACK_DIR / "alembic.ini")
    config.set_main_option("sqlalchemy.url", settings.database_url)
    config.attributes["configure_logger"] = False
    command.upgrade(config, "head")
    return engine


@pytest.fixture
def db(migrated: Engine) -> Iterator[Session]:
    with Session(migrated) as session:
        clear(session)
        session.commit()
        yield session


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as test_client:
        yield test_client
