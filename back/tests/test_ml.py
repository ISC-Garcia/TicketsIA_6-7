import json
from pathlib import Path

import joblib
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sklearn.exceptions import InconsistentVersionWarning
from sqlalchemy.orm import Session

from app.config import Settings
from app.domain import DEPARTMENTS, PRIORITIES
from app.main import create_app
from app.ml import model as model_module
from app.ml import train as train_module
from app.ml.cleaning import clean
from app.ml.dataset import COLUMNS, generate
from app.ml.model import load_model
from app.ml.train import CLEAN_FILE, METRICS_FILE, MODEL_FILE, RAW_FILE
from tests.conftest import SMALL_DATASET, auth_headers


@pytest.fixture(scope="module")
def raw() -> pd.DataFrame:
    return generate(SMALL_DATASET)


def test_e0_04_el_dataset_trae_las_columnas_y_los_duplicados(raw: pd.DataFrame) -> None:
    assert list(raw.columns) == COLUMNS
    # El 2 % de los registros se duplica para que la limpieza los encuentre.
    assert len(raw) == SMALL_DATASET * 102 // 100


def test_e0_04_la_misma_semilla_da_el_mismo_dataset(raw: pd.DataFrame) -> None:
    pd.testing.assert_frame_equal(generate(SMALL_DATASET), raw)
    assert not generate(SMALL_DATASET, seed=7).equals(raw)


def test_e0_04_la_limpieza_deja_datos_validos(raw: pd.DataFrame) -> None:
    cleaned, report = clean(raw)

    assert report["rawRecords"] == len(raw)
    assert report["duplicates"] > 0
    assert report["corruptDates"] > 0
    assert report["cleanRecords"] == len(cleaned)
    assert cleaned.isna().sum().sum() == 0
    assert set(cleaned["departamento_asignado"]) <= set(DEPARTMENTS)
    assert cleaned["tiempo_resolucion_horas"].between(0, 120).all()
    assert not cleaned.duplicated().any()


def test_e0_04_el_entrenamiento_deja_los_archivos_y_las_metricas(trained: Path) -> None:
    for name in (RAW_FILE, CLEAN_FILE, MODEL_FILE, METRICS_FILE):
        assert (trained / name).exists()

    metrics = json.loads((trained / METRICS_FILE).read_text(encoding="utf-8"))
    split = metrics["split"]
    clean_records = metrics["cleaning"]["cleanRecords"]
    assert split["train"] + split["validation"] + split["test"] == clean_records
    assert split["train"] == pytest.approx(clean_records * 0.70, abs=1)
    assert [row["priority"] for row in metrics["classes"]] == list(PRIORITIES)
    assert metrics["confusionMatrix"]["labels"] == list(PRIORITIES)
    matrix = metrics["confusionMatrix"]["matrix"]
    assert sum(map(sum, matrix)) == split["test"]
    assert sum(metrics["distribution"].values()) == clean_records
    assert 0 <= metrics["accuracy"] <= 100
    assert metrics["parameters"]["nEstimators"] == 100
    assert metrics["modelSha256"] == train_module.sha256(trained / MODEL_FILE)


def test_e0_04_entrenar_dos_veces_con_la_semilla_da_el_mismo_modelo(
    trained: Path, tmp_path: Path
) -> None:
    again = train_module.run(tmp_path, records=SMALL_DATASET)
    first = json.loads((trained / METRICS_FILE).read_text(encoding="utf-8"))

    ignore = {"trainedAt", "modelSha256"}
    assert {k: v for k, v in again.items() if k not in ignore} == {
        k: v for k, v in first.items() if k not in ignore
    }
    sample = pd.read_csv(trained / CLEAN_FILE).head(200)
    original = joblib.load(trained / MODEL_FILE)
    repeated = joblib.load(tmp_path / MODEL_FILE)
    assert list(original.predict(sample)) == list(repeated.predict(sample))


def test_e0_04_el_comando_entrena_en_la_carpeta_indicada(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    train_module.main(["--registros", "600", "--carpeta", str(tmp_path)])

    out = capsys.readouterr().out
    assert f"Modelo guardado en {tmp_path / MODEL_FILE}" in out
    assert "Exactitud en pruebas:" in out


def test_e0_04_el_comando_usa_la_carpeta_de_la_configuracion(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, settings: Settings
) -> None:
    calls: list[tuple[Path, int]] = []

    def fake_run(folder: Path, records: int) -> dict:
        calls.append((folder, records))
        return {
            "split": {"train": 1, "validation": 1, "test": 1},
            "cleaning": {"cleanRecords": 3},
            "accuracy": 90.0,
        }

    monkeypatch.setattr(train_module, "run", fake_run)
    monkeypatch.setattr(train_module, "get_settings", lambda: settings)
    train_module.main([])

    assert calls == [(settings.data_dir, 100_000)]


def test_e0_04_sin_modelo_la_api_arranca_y_lo_informa(client: TestClient, demo: Session) -> None:
    body = client.get("/api/model/info", headers=auth_headers(client, "coordinador")).json()

    assert body["loaded"] is False
    assert "Entrénalo con" in body["error"]
    assert body["accuracy"] is None


def test_e0_04_la_api_informa_el_modelo_cargado(
    settings: Settings, trained: Path, demo: Session
) -> None:
    with_model = settings.model_copy(update={"model_path": trained / MODEL_FILE})

    with TestClient(create_app(with_model)) as client:
        info = client.get("/api/model/info", headers=auth_headers(client, "tecnico")).json()
        health = client.get("/api/health").json()

    metrics = json.loads((trained / METRICS_FILE).read_text(encoding="utf-8"))
    assert info == {
        "loaded": True,
        "error": None,
        "trainedAt": metrics["trainedAt"],
        "sklearnVersion": metrics["sklearnVersion"],
        "accuracy": metrics["accuracy"],
        "cleanRecords": metrics["cleaning"]["cleanRecords"],
    }
    assert health["modelLoaded"] is True


def test_e0_04_rechaza_un_modelo_de_otra_version(
    trained: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def old_model(path: Path) -> None:
        raise InconsistentVersionWarning(
            estimator_name="RandomForestClassifier",
            current_sklearn_version="1.9.1",
            original_sklearn_version="1.9.0",
        )

    monkeypatch.setattr(model_module.joblib, "load", old_model)
    state = load_model(trained / MODEL_FILE)

    assert state.loaded is False
    assert state.error is not None
    assert "scikit-learn 1.9.0" in state.error
    assert state.metrics["accuracy"] >= 0


def test_e0_04_rechaza_un_archivo_danado(tmp_path: Path) -> None:
    broken = tmp_path / MODEL_FILE
    broken.write_bytes(b"no es un modelo")

    state = load_model(broken)

    assert state.loaded is False
    assert state.error is not None
    assert state.error.startswith("No se pudo leer el modelo")
    assert state.metrics == {}
