from fastapi import APIRouter, Depends, Request

from app.auth import current_user
from app.ml.model import ModelState
from app.schemas import ApiModel

# Cualquier rol con sesión puede saber si el modelo está disponible.
router = APIRouter(prefix="/api/model", tags=["modelo"], dependencies=[Depends(current_user)])


class ModelInfo(ApiModel):
    loaded: bool
    error: str | None
    trained_at: str | None
    sklearn_version: str | None
    accuracy: float | None
    clean_records: int | None


@router.get("/info")
def model_info(request: Request) -> ModelInfo:
    model: ModelState = request.app.state.model
    metrics = model.metrics
    return ModelInfo(
        loaded=model.loaded,
        error=model.error,
        trained_at=metrics.get("trainedAt"),
        sklearn_version=metrics.get("sklearnVersion"),
        accuracy=metrics.get("accuracy"),
        clean_records=metrics.get("cleaning", {}).get("cleanRecords"),
    )
