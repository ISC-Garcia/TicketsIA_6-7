"""Procesamiento de lenguaje natural de la descripción de un ticket.

Reemplaza a `scripts_ml/pipeline_pnl.py`: reconoce dispositivos y códigos de error (NER por
catálogo y patrón), obtiene las palabras clave por su peso TF-IDF y clasifica la intención.
"""

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from app.ml.dataset import DEVICES

# Los 20 dispositivos del dataset, más los del prototipo que se escriben distinto.
DEVICE_CATALOG = sorted(
    {device for devices in DEVICES.values() for device in devices}
    | {"Switch de núcleo", "Base de datos", "Servidor principal", "Impresora", "Laptop"},
    key=len,
    reverse=True,
)
ERROR_CODE = re.compile(r"\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b")
WORD = re.compile(r"\b[^\W\d_]{4,}\b")
KEYWORD_COUNT = 6

INCIDENT = "Reporte de incidente"
HARDWARE_REQUEST = "Solicitud de hardware"
QUESTION = "Consulta general"
HARDWARE_WORDS = ("reemplazo", "fisica", "desgaste", "nuevo", "nueva", "cambio de")
QUESTION_WORDS = ("duda", "como ", "asesoria", "configuracion", "quisiera saber")

STOPWORDS = frozenset(
    [
        "algo",
        "algun",
        "alguna",
        "antes",
        "aqui",
        "como",
        "con",
        "contra",
        "cual",
        "cuando",
        "desde",
        "donde",
        "durante",
        "el",
        "ella",
        "ellos",
        "entre",
        "esta",
        "este",
        "esto",
        "estos",
        "estas",
        "favor",
        "hace",
        "hasta",
        "hola",
        "mismo",
        "mucho",
        "muy",
        "nada",
        "otra",
        "otro",
        "para",
        "pero",
        "poco",
        "porque",
        "puede",
        "pueden",
        "quiero",
        "sido",
        "sobre",
        "solo",
        "tambien",
        "tengo",
        "tiene",
        "todo",
        "todos",
        "tras",
        "unas",
        "unos",
        "usted",
        "ustedes",
        "desde",
        "mientras",
        "siempre",
        "ahora",
        "estoy",
        "estamos",
        "esta",
        "estan",
        "seria",
        "sigue",
    ]
)


def fold(text: str) -> str:
    """Minúsculas y sin acentos, carácter por carácter, para que los índices coincidan."""
    return "".join(
        unicodedata.normalize("NFD", char)[0].lower() if char.isalpha() else char.lower()
        for char in text
    )


@dataclass
class Entities:
    devices: list[str] = field(default_factory=list)
    error_codes: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    intent: str = INCIDENT
    # Fragmentos tal como aparecen en el texto, para resaltarlos en el front.
    highlights: list[str] = field(default_factory=list)


def find_devices(text: str) -> tuple[list[str], list[str]]:
    """Devuelve los dispositivos del catálogo y el fragmento original de cada uno, en el orden
    en que aparecen en el texto."""
    folded = fold(text)
    taken = [False] * len(text)
    found: list[tuple[int, str, str]] = []
    # Los nombres largos se buscan primero: "Servidor Web" no debe quedar como solo "Servidor".
    for device in DEVICE_CATALOG:
        for match in re.finditer(rf"\b{re.escape(fold(device))}\b", folded):
            start, end = match.span()
            if any(taken[start:end]):
                continue
            taken[start:end] = [True] * (end - start)
            found.append((start, device, text[start:end]))

    found.sort()
    devices = list(dict.fromkeys(device for _, device, _ in found))
    fragments = list(dict.fromkeys(fragment for _, _, fragment in found))
    return devices, fragments


def find_error_codes(text: str) -> list[str]:
    return list(dict.fromkeys(ERROR_CODE.findall(text)))


def detect_intent(text: str) -> str:
    folded = f" {fold(text)} "
    if any(word in folded for word in HARDWARE_WORDS):
        return HARDWARE_REQUEST
    if any(word in folded for word in QUESTION_WORDS) or "?" in text:
        return QUESTION
    return INCIDENT


def candidate_words(text: str) -> list[str]:
    return [word for word in WORD.findall(text.lower()) if fold(word) not in STOPWORDS]


def find_keywords(text: str, vectorizer: Any = None, count: int = KEYWORD_COUNT) -> list[str]:
    """Palabras con más peso TF-IDF en el texto. Sin vocabulario entrenado, las más frecuentes."""
    candidates = candidate_words(text)
    if not candidates:
        return []

    if vectorizer is not None:
        weights = vectorizer.transform([text]).toarray()[0]
        vocabulary = vectorizer.vocabulary_
        scored = {word: weights[vocabulary[word]] for word in candidates if word in vocabulary}
        if scored:
            ranked = sorted(scored, key=lambda word: (-scored[word], candidates.index(word)))
            return ranked[:count]

    frequency = Counter(candidates)
    ranked = sorted(frequency, key=lambda word: (-frequency[word], candidates.index(word)))
    return ranked[:count]


def text_vectorizer(pipeline: Any) -> Any:
    """El TF-IDF que el modelo aprendió de la descripción, o None si no hay modelo."""
    if pipeline is None:
        return None
    return pipeline.named_steps["preprocesamiento"].named_transformers_["texto"]


def extract(text: str, vectorizer: Any = None) -> Entities:
    devices, fragments = find_devices(text)
    codes = find_error_codes(text)
    return Entities(
        devices=devices,
        error_codes=codes,
        keywords=find_keywords(text, vectorizer),
        intent=detect_intent(text),
        highlights=[*fragments, *codes],
    )
