from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import Depends
from pydantic import AwareDatetime, Field, field_validator, model_validator
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
    # Hora fija solo para las pruebas automáticas. Fuera de ellas se usa el reloj real.
    app_now: AwareDatetime | None = None
    timezone: str = "America/Mexico_City"
    data_dir: Path = BACK_DIR / "datos"
    model_path: Path | None = None
    cors_origins: list[str] = ["http://localhost:5173"]
    # Firma de los tokens de sesión. Sin valor por omisión, igual que la conexión.
    jwt_secret: str = Field(min_length=32)
    session_hours: int = 8

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

    @model_validator(mode="after")
    def fixed_clock_only_in_tests(self) -> "Settings":
        if self.app_now and self.app_env != "test":
            raise ValueError(
                "APP_NOW solo se permite con APP_ENV=test: en desarrollo y producción la API "
                "usa el reloj real. Quita APP_NOW de back/.env."
            )
        return self

    @property
    def zone(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)

    @property
    def model_file(self) -> Path:
        return self.model_path or self.data_dir / "modelo_tickets.joblib"

    def now(self) -> datetime:
        return self.app_now or datetime.now(self.zone)

    def local(self, moment: datetime, seconds: bool = True) -> str:
        """Hora local de la mesa de ayuda, sin zona, en el formato que muestra el front."""
        pattern = "%Y-%m-%d %H:%M:%S" if seconds else "%Y-%m-%d %H:%M"
        return moment.astimezone(self.zone).strftime(pattern)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # pyright: ignore[reportCallIssue]


SettingsDep = Annotated[Settings, Depends(get_settings)]
