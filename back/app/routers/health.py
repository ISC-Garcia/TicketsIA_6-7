from fastapi import APIRouter, Request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import SettingsDep
from app.db import DbDep
from app.schemas import ApiModel

router = APIRouter(prefix="/api", tags=["salud"])


class Health(ApiModel):
    status: str
    database: bool
    model_loaded: bool
    now: str


@router.get("/health")
def health(request: Request, db: DbDep, settings: SettingsDep) -> Health:
    try:
        db.execute(text("SELECT 1"))
        database = True
    except SQLAlchemyError:
        database = False

    return Health(
        status="ok" if database else "degradado",
        database=database,
        model_loaded=request.app.state.model is not None,
        now=settings.now().isoformat(),
    )
