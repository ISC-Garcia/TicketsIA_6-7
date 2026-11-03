from pathlib import Path

import joblib
import pytest

from app.ml.pnl import (
    HARDWARE_REQUEST,
    INCIDENT,
    QUESTION,
    extract,
    find_keywords,
    fold,
    text_vectorizer,
)
from app.ml.train import MODEL_FILE

# Un caso por prioridad, con las plantillas del dataset sintético.
CASES = [
    (
        "Crítica",
        "Caída total y pérdida de ping hacia el nodo principal del Cluster K8s con alerta "
        "DEADLOCK_DB. Esto detiene la facturación y la operación de toda la empresa.",
        ["Cluster K8s"],
        ["DEADLOCK_DB"],
        INCIDENT,
    ),
    (
        "Alta",
        "El servicio del Storage SAN está degradado afectando a múltiples usuarios concurrentes "
        "por SSL_EXPIRED. El cierre mensual contable está en riesgo.",
        ["Storage SAN"],
        ["SSL_EXPIRED"],
        INCIDENT,
    ),
    (
        "Media",
        "Tengo problemas para utilizar la Impresora de Red en mi estación de trabajo. "
        "Favor de agendar una revisión cuando haya un técnico disponible.",
        ["Impresora de Red"],
        [],
        INCIDENT,
    ),
    (
        "Baja",
        "Requiero un reemplazo o revisión física de mi Teclado Inalámbrico por desgaste. "
        "Agradezco su apoyo sin prisa alguna.",
        ["Teclado Inalámbrico"],
        [],
        HARDWARE_REQUEST,
    ),
]


@pytest.mark.parametrize(("priority", "text", "devices", "codes", "intent"), CASES)
def test_e3_01_reconoce_entidades_e_intencion_por_prioridad(
    priority: str, text: str, devices: list[str], codes: list[str], intent: str
) -> None:
    entities = extract(text)

    assert entities.devices == devices, priority
    assert entities.error_codes == codes
    assert entities.intent == intent
    assert entities.highlights == devices + codes
    assert entities.keywords


def test_e3_01_un_texto_sin_entidades() -> None:
    entities = extract("No sé qué pasa, a veces falla y no puedo trabajar.")

    assert entities.devices == []
    assert entities.error_codes == []
    assert entities.highlights == []
    assert entities.intent == INCIDENT


def test_e3_01_reconoce_dispositivos_sin_importar_acentos_ni_mayusculas() -> None:
    entities = extract("El MOUSE OPTICO y la paqueteria office dejaron de responder.")

    assert entities.devices == ["Mouse Óptico", "Paquetería Office"]
    # Se resalta el texto tal como lo escribió la persona.
    assert entities.highlights == ["MOUSE OPTICO", "paqueteria office"]


def test_e3_01_prefiere_el_nombre_mas_largo() -> None:
    entities = extract("Se cayó el Servidor Web y también el servidor principal.")

    assert entities.devices == ["Servidor Web", "Servidor principal"]


def test_e3_01_no_repite_dispositivos_ni_codigos() -> None:
    entities = extract("Firewall con HIGH_LATENCY. Reinicié el firewall y sigue HIGH_LATENCY.")

    assert entities.devices == ["Firewall"]
    assert entities.error_codes == ["HIGH_LATENCY"]
    assert entities.highlights == ["Firewall", "firewall", "HIGH_LATENCY"]


@pytest.mark.parametrize(
    "text",
    ["¿Cómo configuro la VPN?", "Tengo una duda con mi correo", "Quisiera asesoría rápida."],
)
def test_e3_01_detecta_consultas(text: str) -> None:
    assert extract(text).intent == QUESTION


def test_e3_01_codigos_con_numeros() -> None:
    assert extract("Responde TIMEOUT_504 y luego AUTH_401.").error_codes == [
        "TIMEOUT_504",
        "AUTH_401",
    ]


def test_e3_01_palabras_clave_sin_modelo_por_frecuencia() -> None:
    keywords = find_keywords("La impresora no imprime. La impresora marca error de papel.")

    assert keywords[0] == "impresora"
    assert "para" not in keywords
    assert find_keywords("de la a el") == []


def test_e3_01_palabras_clave_con_el_tfidf_del_modelo(trained: Path) -> None:
    vectorizer = text_vectorizer(joblib.load(trained / MODEL_FILE))
    text = CASES[0][1]

    keywords = find_keywords(text, vectorizer)

    assert 0 < len(keywords) <= 6
    assert all(word in vectorizer.vocabulary_ for word in keywords)
    assert extract(text, vectorizer).keywords == keywords


def test_e3_01_sin_vocabulario_comun_usa_la_frecuencia(trained: Path) -> None:
    vectorizer = text_vectorizer(joblib.load(trained / MODEL_FILE))

    assert find_keywords("zzzz yyyy zzzz", vectorizer) == ["zzzz", "yyyy"]


def test_e3_01_sin_modelo_no_hay_vectorizador() -> None:
    assert text_vectorizer(None) is None


def test_e3_01_fold_conserva_la_longitud() -> None:
    text = "Ñandú, Óptico y Sistema Contable"

    assert fold(text) == "nandu, optico y sistema contable"
    assert len(fold(text)) == len(text)
