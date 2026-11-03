import json
import logging
import warnings
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import joblib
from sklearn.exceptions import InconsistentVersionWarning

from app.ml.train import METRICS_FILE

logger = logging.getLogger(__name__)


@dataclass
class ModelState:
    """El modelo cargado al arrancar, o el motivo por el que no se pudo cargar."""

    pipeline: Any = None
    metrics: dict[str, Any] = field(default_factory=dict)
    error: str | None = None

    @property
    def loaded(self) -> bool:
        return self.pipeline is not None


def load_model(path: Path) -> ModelState:
    if not path.exists():
        return ModelState(error=f"No existe {path}. Entrénalo con `uv run python -m app.ml.train`.")

    metrics_path = path.with_name(METRICS_FILE)
    metrics = json.loads(metrics_path.read_text(encoding="utf-8")) if metrics_path.exists() else {}

    # Un modelo de otra versión de scikit-learn puede dar resultados inválidos: no se usa.
    with warnings.catch_warnings():
        warnings.simplefilter("error", InconsistentVersionWarning)
        try:
            pipeline = joblib.load(path)
        except InconsistentVersionWarning as warning:
            return ModelState(
                metrics=metrics,
                error=(
                    f"El modelo se entrenó con scikit-learn {warning.original_sklearn_version} "
                    f"y está instalada la {warning.current_sklearn_version}. Vuelve a entrenarlo."
                ),
            )
        except Exception as error:
            logger.exception("No se pudo cargar el modelo de %s", path)
            return ModelState(metrics=metrics, error=f"No se pudo leer el modelo: {error}")

    return ModelState(pipeline=pipeline, metrics=metrics)
