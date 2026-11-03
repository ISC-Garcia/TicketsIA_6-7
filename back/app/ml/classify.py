"""Clasificación de un ticket nuevo: PNL más los tres clasificadores entrenados."""

from dataclasses import dataclass
from typing import Any

import pandas as pd

from app.domain import PRIORITIES
from app.ml.pnl import Entities, extract, text_vectorizer
from app.ml.train import CATEGORY_FEATURES, DEPARTMENT, PRIORITY, SENTIMENT, TEXT_FEATURE

UNKNOWN_DEVICE = "Sin Especificar"


@dataclass
class Classification:
    priority: str
    confidence: int
    probabilities: dict[str, int]
    department: str
    sentiment: str
    device: str
    device_detected: bool
    entities: Entities

    def analysis(self) -> dict[str, Any]:
        """El análisis con la forma del tipo `Analysis` del front."""
        return {
            "confidence": self.confidence,
            "probabilities": self.probabilities,
            "sentiment": self.sentiment,
            "intent": self.entities.intent,
            "keywords": self.entities.keywords,
            "devices": self.entities.devices,
            "errorCodes": self.entities.error_codes,
        }


def as_percentages(probabilities: dict[str, float]) -> dict[str, int]:
    """Porcentajes enteros que suman 100: se reparte el sobrante a los restos mayores."""
    raw = {label: value * 100 for label, value in probabilities.items()}
    whole = {label: int(value) for label, value in raw.items()}
    missing = 100 - sum(whole.values())
    for label in sorted(raw, key=lambda label: raw[label] - whole[label], reverse=True)[:missing]:
        whole[label] += 1
    return {priority: whole.get(priority, 0) for priority in PRIORITIES}


def classify(
    model: dict[str, Any], description: str, area: str, device: str | None
) -> Classification:
    entities = extract(description, text_vectorizer(model))
    typed_device = (device or "").strip()
    detected = not typed_device and bool(entities.devices)
    chosen_device = typed_device or (entities.devices[0] if entities.devices else UNKNOWN_DEVICE)

    department = str(model[DEPARTMENT].predict([description])[0])
    sentiment = str(model[SENTIMENT].predict([description])[0])
    features = pd.DataFrame(
        [
            {
                TEXT_FEATURE: description,
                CATEGORY_FEATURES[0]: area,
                CATEGORY_FEATURES[1]: chosen_device,
                CATEGORY_FEATURES[2]: department,
                CATEGORY_FEATURES[3]: sentiment,
            }
        ]
    )
    classifier = model[PRIORITY]
    scores = dict(zip(classifier.classes_, classifier.predict_proba(features)[0], strict=True))
    probabilities = as_percentages(scores)
    priority = max(scores, key=lambda label: scores[label])
    return Classification(
        priority=priority,
        confidence=probabilities[priority],
        probabilities=probabilities,
        department=department,
        sentiment=sentiment,
        device=chosen_device,
        device_detected=detected,
        entities=entities,
    )
