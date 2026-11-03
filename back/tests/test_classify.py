from pathlib import Path

import joblib
import pytest

from app.domain import DEPARTMENTS, PRIORITIES
from app.ml.classify import UNKNOWN_DEVICE, as_percentages, classify
from app.ml.train import MODEL_FILE

CRITICAL = (
    "Caída total y pérdida de ping hacia el nodo principal del Cluster K8s con alerta "
    "DEADLOCK_DB. Esto detiene la facturación y la operación de toda la empresa a nivel nacional."
)
LOW = (
    "Quisiera solicitar asesoría rápida sobre la configuración de mi Mouse Óptico. "
    "Es una duda general que no afecta mi desempeño operativo diario."
)


@pytest.fixture(scope="module")
def model(trained: Path) -> dict:
    return joblib.load(trained / MODEL_FILE)


def test_e3_02_clasifica_con_probabilidades_del_modelo(model: dict) -> None:
    result = classify(model, CRITICAL, "Operaciones", None)

    assert result.priority == "Crítica"
    assert list(result.probabilities) == list(PRIORITIES)
    assert sum(result.probabilities.values()) == 100
    assert result.confidence == result.probabilities["Crítica"]
    assert result.confidence == max(result.probabilities.values())
    assert result.department in DEPARTMENTS
    assert result.sentiment == "Negativo"


def test_e3_02_un_texto_menor_queda_en_prioridad_baja(model: dict) -> None:
    result = classify(model, LOW, "Ventas", None)

    assert result.priority == "Baja"
    assert result.entities.intent == "Consulta general"


def test_e3_02_usa_el_dispositivo_detectado_si_no_se_escribe(model: dict) -> None:
    detected = classify(model, CRITICAL, "Operaciones", "   ")
    typed = classify(model, CRITICAL, "Operaciones", "Servidor Web")
    unknown = classify(model, "No sé qué pasa, a veces falla y no puedo trabajar.", "Ventas", None)

    assert (detected.device, detected.device_detected) == ("Cluster K8s", True)
    assert (typed.device, typed.device_detected) == ("Servidor Web", False)
    assert (unknown.device, unknown.device_detected) == (UNKNOWN_DEVICE, False)


def test_e3_02_el_analisis_tiene_la_forma_del_front(model: dict) -> None:
    analysis = classify(model, CRITICAL, "Operaciones", None).analysis()

    assert set(analysis) == {
        "confidence",
        "probabilities",
        "sentiment",
        "intent",
        "keywords",
        "devices",
        "errorCodes",
    }
    assert analysis["errorCodes"] == ["DEADLOCK_DB"]
    assert analysis["devices"] == ["Cluster K8s"]


@pytest.mark.parametrize(
    ("scores", "expected"),
    [
        (
            {"Crítica": 0.333, "Alta": 0.333, "Media": 0.334},
            {"Crítica": 33, "Alta": 33, "Media": 34, "Baja": 0},
        ),
        ({"Crítica": 0.996, "Baja": 0.004}, {"Crítica": 100, "Alta": 0, "Media": 0, "Baja": 0}),
        ({"Alta": 1.0}, {"Crítica": 0, "Alta": 100, "Media": 0, "Baja": 0}),
    ],
)
def test_e3_02_los_porcentajes_suman_100(scores: dict, expected: dict) -> None:
    assert as_percentages(scores) == expected
