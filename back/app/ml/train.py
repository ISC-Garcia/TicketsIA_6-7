"""Genera el dataset, lo limpia y entrena el clasificador de prioridad.

    uv run python -m app.ml.train [--registros 100000] [--carpeta back/datos]

Reemplaza a `dataset_sintetico.py`, `limpieza_masiva.py` y `entrenamiento_ml.py`. Cada paso
escribe su archivo en la carpeta, como antes, y al final se guardan el modelo y `metricas.json`.
"""

import argparse
import hashlib
import json
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from app.config import get_settings
from app.domain import PRIORITIES
from app.ml.cleaning import clean
from app.ml.dataset import RECORDS, SEED, generate

RAW_FILE = "tickets_soporte.csv"
CLEAN_FILE = "tickets_soporte_procesado.csv"
MODEL_FILE = "modelo_tickets.joblib"
METRICS_FILE = "metricas.json"

TEXT_FEATURE = "descripcion_problema"
CATEGORY_FEATURES = [
    "area_solicitante",
    "dispositivo_afectado",
    "departamento_asignado",
    "sentimiento",
]
TARGET = "prioridad"
N_ESTIMATORS = 100
TFIDF_MAX_FEATURES = 1000


def build_pipeline(seed: int) -> Pipeline:
    features = ColumnTransformer(
        transformers=[
            ("texto", TfidfVectorizer(max_features=TFIDF_MAX_FEATURES), TEXT_FEATURE),
            ("categorias", OneHotEncoder(handle_unknown="ignore"), CATEGORY_FEATURES),
        ]
    )
    classifier = RandomForestClassifier(
        n_estimators=N_ESTIMATORS, class_weight="balanced", random_state=seed, n_jobs=-1
    )
    return Pipeline(steps=[("preprocesamiento", features), ("clasificador", classifier)])


def percent(value: float) -> float:
    return round(float(value) * 100, 2)


def train(df: pd.DataFrame, seed: int = SEED) -> tuple[Pipeline, dict[str, Any]]:
    """Divide 70/15/15, entrena y evalúa con el 15 % de prueba."""
    x = df[[TEXT_FEATURE, *CATEGORY_FEATURES]]
    y = df[TARGET]
    x_train, x_rest, y_train, y_rest = train_test_split(
        x, y, test_size=0.30, random_state=seed, stratify=y
    )
    x_val, x_test, y_val, y_test = train_test_split(
        x_rest, y_rest, test_size=0.50, random_state=seed, stratify=y_rest
    )

    pipeline = build_pipeline(seed).fit(x_train, y_train)
    predicted = pipeline.predict(x_test)
    precision, recall, f1, support = precision_recall_fscore_support(
        y_test, predicted, labels=list(PRIORITIES), zero_division=0
    )

    metrics = {
        "accuracy": percent(accuracy_score(y_test, predicted)),
        "validationAccuracy": percent(accuracy_score(y_val, pipeline.predict(x_val))),
        "classes": [
            {
                "priority": priority,
                "precision": percent(precision[index]),
                "recall": percent(recall[index]),
                "f1": percent(f1[index]),
                "support": int(support[index]),
            }
            for index, priority in enumerate(PRIORITIES)
        ],
        "confusionMatrix": {
            "labels": list(PRIORITIES),
            "matrix": confusion_matrix(y_test, predicted, labels=list(PRIORITIES)).tolist(),
        },
        "split": {"train": len(x_train), "validation": len(x_val), "test": len(x_test)},
        "distribution": {priority: int((y == priority).sum()) for priority in PRIORITIES},
        "parameters": {
            "algorithm": "Random Forest",
            "nEstimators": N_ESTIMATORS,
            "classWeight": "balanced",
            "tfidfMaxFeatures": TFIDF_MAX_FEATURES,
            "textFeature": TEXT_FEATURE,
            "categoryFeatures": CATEGORY_FEATURES,
            "target": TARGET,
            "seed": seed,
        },
    }
    return pipeline, metrics


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run(folder: Path, records: int = RECORDS, seed: int = SEED) -> dict[str, Any]:
    """Ejecuta los tres pasos y deja en `folder` los CSV, el modelo y sus métricas."""
    folder.mkdir(parents=True, exist_ok=True)

    # Cada paso lee el archivo del anterior, como los scripts originales: así los tipos de
    # pandas son los mismos y el resultado coincide con el de esos scripts.
    generate(records, seed).to_csv(folder / RAW_FILE, index=False, encoding="utf-8")
    cleaned, cleaning = clean(pd.read_csv(folder / RAW_FILE))
    cleaned.to_csv(folder / CLEAN_FILE, index=False, encoding="utf-8")
    pipeline, metrics = train(pd.read_csv(folder / CLEAN_FILE), seed)

    model_path = folder / MODEL_FILE
    joblib.dump(pipeline, model_path, compress=3)
    metrics |= {
        "trainedAt": datetime.now(UTC).isoformat(timespec="seconds"),
        "sklearnVersion": sklearn.__version__,
        "cleaning": cleaning,
        "modelSha256": sha256(model_path),
    }
    (folder / METRICS_FILE).write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return metrics


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.ml.train")
    parser.add_argument("--registros", type=int, default=RECORDS)
    parser.add_argument("--carpeta", type=Path, default=None)
    args = parser.parse_args(argv)

    folder = args.carpeta or get_settings().data_dir
    metrics = run(folder, args.registros)
    split = metrics["split"]
    print(
        f"Modelo guardado en {folder / MODEL_FILE}\n"
        f"Registros limpios: {metrics['cleaning']['cleanRecords']:,} "
        f"(entrenamiento {split['train']:,}, evaluación {split['validation']:,}, "
        f"pruebas {split['test']:,})\n"
        f"Exactitud en pruebas: {metrics['accuracy']} %"
    )


if __name__ == "__main__":  # pragma: no cover
    main()
