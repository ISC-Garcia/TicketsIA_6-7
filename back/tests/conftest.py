from collections.abc import Iterator
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

NOW = datetime(2026, 10, 28, 11, 42, 10, tzinfo=ZoneInfo("America/Mexico_City"))


@pytest.fixture(scope="session")
def settings() -> Settings:
    base = Settings()  # pyright: ignore[reportCallIssue]
    if not base.test_database_url:
        pytest.exit("Falta TEST_DATABASE_URL: las pruebas nunca usan la base de desarrollo.")
    if base.test_database_url == base.database_url:
        pytest.exit("TEST_DATABASE_URL debe apuntar a una base distinta de DATABASE_URL.")

    return base.model_copy(
        update={"app_env": "test", "database_url": base.test_database_url, "app_now": NOW}
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as test_client:
        yield test_client
