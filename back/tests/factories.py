from typing import Any

from app.models import Ticket
from tests.conftest import NOW


def make_ticket(**values: Any) -> Ticket:
    fields: dict[str, Any] = {
        "id": "TCK-900001",
        "priority": "Media",
        "area": "Ventas",
        "device": "Impresora de Red",
        "department": "Soporte de Aplicaciones",
        "status": "Abierto",
        "created_at": NOW,
        "reporter": "Persona de prueba",
        "summary": "Impresora sin conexión",
        "description": "La impresora de red no responde desde la mañana.",
        "highlights": [],
    }
    return Ticket(**(fields | values))
