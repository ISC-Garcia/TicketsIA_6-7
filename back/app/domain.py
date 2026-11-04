"""Catálogos del dominio. Son los mismos valores que `front/src/types/`."""

PRIORITIES = ("Crítica", "Alta", "Media", "Baja")
TICKET_STATUSES = ("Abierto", "En atención", "Resuelto")
DEPARTMENTS = (
    "Infraestructura Cloud",
    "Seguridad Informática",
    "Redes y Conectividad",
    "Hardware y Soporte Local",
    "Soporte de Aplicaciones",
)
AREAS = ("Ventas", "Contabilidad", "Recursos Humanos", "Sistemas", "Operaciones", "Dirección")
ROLES = ("tecnico", "coordinador", "auditor")

# Horas de SLA por prioridad, las mismas de `front/src/utils/sla.ts`.
SLA_HOURS = {"Crítica": 4, "Alta": 12, "Media": 48, "Baja": 96}

# Autor de los eventos que genera el propio sistema, como la clasificación.
SYSTEM_USER = "Sistema"
