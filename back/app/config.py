from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import Depends
from pydantic import AwareDatetime, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACK_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Configuración leída de variables de entorno o de `back/.env`.

    No hay valores por omisión para la conexión: sin `DATABASE_URL` la API no arranca.
    """

    model_config = SettingsConfigDict(env_file=BACK_DIR / ".env", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    database_url: str
    test_database_url: str | None = None
    # Hora fija para demo y pruebas. En producción se deja vacía y se usa el reloj real.
    app_now: AwareDatetime | None = None
    timezone: str = "America/Mexico_City"
    data_dir: Path = BACK_DIR / "datos"
    model_path: Path | None = None
    cors_origins: list[str] = ["http://localhost:5173"]

    @field_validator("database_url", "test_database_url")
    @classmethod
    def use_psycopg(cls, value: str | None) -> str | None:
        # Render y otros servicios entregan `postgres://` o `postgresql://`.
        if value is None:
            return None
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value.removeprefix(prefix)
        return value

    @property
    def zone(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)

    @property
    def model_file(self) -> Path:
        return self.model_path or self.data_dir / "modelo_tickets.joblib"

    def now(self) -> datetime:
        return self.app_now or datetime.now(self.zone)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # pyright: ignore[reportCallIssue]


SettingsDep = Annotated[Settings, Depends(get_settings)]
