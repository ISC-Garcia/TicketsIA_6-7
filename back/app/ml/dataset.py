"""Generador del dataset sintético de tickets (antes `scripts_ml/dataset_sintetico.py`).

Conserva la lógica y el orden de las llamadas al azar del script original, para que con la
semilla 42 y 100,000 registros produzca el mismo archivo.
"""

import random
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

RECORDS = 100_000
SEED = 42
END_DATE = datetime(2026, 10, 7, 12, 0, 0)
START_DATE = END_DATE - timedelta(days=365)

COLUMNS = [
    "id_ticket",
    "fecha_creacion",
    "area_solicitante",
    "dispositivo_afectado",
    "descripcion_problema",
    "departamento_asignado",
    "sentimiento",
    "prioridad",
    "tiempo_resolucion_horas",
]

AREAS = ["Ventas", "Contabilidad", "Recursos Humanos", "Sistemas", "Operaciones", "Dirección"]
CRITICAL_DEPARTMENTS = ["Infraestructura Cloud", "Seguridad Informática", "Redes y Conectividad"]
MINOR_DEPARTMENTS = ["Hardware y Soporte Local", "Soporte de Aplicaciones"]

DEVICES = {
    "Crítica": ["Servidor Ubuntu", "Base de Datos", "Firewall", "Switch Core", "Cluster K8s"],
    "Alta": ["Gateway VPN", "Servidor Web", "Storage SAN", "Router Sucursal", "Active Directory"],
    "Media": [
        "Impresora de Red",
        "Paquetería Office",
        "Monitor Principal",
        "Acceso a Carpeta",
        "Sistema Contable",
    ],
    "Baja": ["Teclado Inalámbrico", "Mouse Óptico", "Diadema", "Cable HDMI", "Funda de Laptop"],
}
ERROR_CODES = {
    "Crítica": ["KERNEL_PANIC", "DEADLOCK_DB", "DDOS_ATTACK", "HARDWARE_FAILURE"],
    "Alta": ["TIMEOUT_504", "SSL_EXPIRED", "AUTH_401", "HIGH_LATENCY"],
}

TEMPLATES = {
    "Crítica": (
        [
            "El {disp} se encuentra completamente fuera de servicio por {err}.",
            "Caída total y pérdida de ping hacia el nodo principal del {disp} con alerta {err}.",
        ],
        [
            "Esto detiene la facturación y la operación de toda la empresa a nivel nacional.",
            "Todo el personal está paralizado sin poder acceder a los sistemas core.",
        ],
        [
            "La resolución es de máxima prioridad. El SLA está siendo vulnerado gravemente.",
            "Requerimos escalamiento inmediato a nivel directivo. Pérdidas económicas activas.",
        ],
    ),
    "Alta": (
        [
            "Detectamos lentitud extrema y desconexiones esporádicas en el {disp} marcando {err}.",
            "El servicio del {disp} está degradado afectando a múltiples usuarios concurrentes "
            "por {err}.",
        ],
        [
            "Un grupo importante de usuarios externos no puede completar sus transacciones.",
            "El cierre mensual contable está en riesgo de retraso significativo.",
        ],
        [
            "Urge intervención del equipo de infraestructura antes de que se vuelva crítico.",
            "Solicitamos revisión prioritaria en el transcurso del turno.",
        ],
    ),
    "Media": (
        [
            "Tengo problemas para utilizar la {disp} en mi estación de trabajo.",
            "El sistema reporta un fallo menor al intentar acceder a la {disp}.",
        ],
        [
            "Esto retrasa ligeramente mi reporte individual de hoy.",
            "No puedo imprimir los recibos físicos, pero los tengo en digital.",
        ],
        [
            "Quedo a la espera de que soporte local pueda conectarse a mi equipo.",
            "Favor de agendar una revisión cuando haya un técnico disponible.",
        ],
    ),
    "Baja": (
        [
            "Requiero un reemplazo o revisión física de mi {disp} por desgaste.",
            "Quisiera solicitar asesoría rápida sobre la configuración de mi {disp}.",
        ],
        [
            "Puedo seguir trabajando sin problemas, es solo para mejorar mi ergonomía.",
            "Es una duda general que no afecta mi desempeño operativo diario.",
        ],
        [
            "Agradezco su apoyo sin prisa alguna. Buen día.",
            "Cuando tengan un espacio libre me avisan, gracias por la ayuda.",
        ],
    ),
}

# Plantillas ambiguas (~5 % de los casos) para que el modelo no tenga un problema trivial.
NOISE = (
    [
        "No sé qué pasa con el {disp}, a veces falla.",
        "Creo que se descompuso el {disp}.",
        "Revisen el {disp} por favor.",
    ],
    [
        "No puedo trabajar.",
        "Afecta mi día en la oficina.",
        "Es muy molesto tener que reportar esto.",
    ],
    ["Ayuda por favor.", "Urgente que lo revisen.", "Gracias de antemano."],
)

# Sentimiento según la prioridad: (normal, ambiguo). La Baja elige entre dos al azar.
SENTIMENTS = {
    "Crítica": ("Negativo", "Neutral"),
    "Alta": ("Negativo", "Positivo"),
    "Media": ("Neutral", "Negativo"),
}
RESOLUTION_HOURS = {"Crítica": (0.5, 4.0), "Alta": (2.0, 12.0), "Media": (12.0, 48.0)}
LOW_RESOLUTION_HOURS = (24.0, 96.0)


def describe(priority: str, device: str, error: str | None, ambiguous: bool) -> str:
    symptoms, impacts, tones = NOISE if ambiguous else TEMPLATES[priority]
    symptom = random.choice(symptoms).format(disp=device, err=error)
    return f"{symptom} {random.choice(impacts)} {random.choice(tones)}"


def generate(records: int = RECORDS, seed: int = SEED) -> pd.DataFrame:
    # El script original usa los generadores globales; se conservan para obtener el mismo archivo.
    random.seed(seed)
    np.random.seed(seed)

    seconds = int((END_DATE - START_DATE).total_seconds())
    priorities = np.random.choice(
        ["Crítica", "Alta", "Media", "Baja"], size=records, p=[0.15, 0.20, 0.35, 0.30]
    )
    offsets = np.random.randint(0, seconds, size=records)

    rows = []
    for index in range(records):
        created = (START_DATE + timedelta(seconds=int(offsets[index]))).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
        area = random.choice(AREAS)
        priority = str(priorities[index])
        ambiguous = random.random() < 0.05

        device = random.choice(DEVICES[priority])
        error = random.choice(ERROR_CODES[priority]) if priority in ERROR_CODES else None
        description = describe(priority, device, error, ambiguous)
        critical = priority in ("Crítica", "Alta")
        department = random.choice(CRITICAL_DEPARTMENTS if critical else MINOR_DEPARTMENTS)
        if priority == "Baja":
            sentiment = "Negativo" if ambiguous else random.choice(["Neutral", "Positivo"])
            hours = round(random.uniform(*LOW_RESOLUTION_HOURS), 2)
        else:
            sentiment = SENTIMENTS[priority][ambiguous]
            hours = round(random.uniform(*RESOLUTION_HOURS[priority]), 2)

        rows.append(
            [
                f"TCK-{100000 + index + 1}",
                created,
                area,
                device,
                description,
                department,
                sentiment,
                priority,
                hours,
            ]
        )

    df = pd.DataFrame(rows, columns=COLUMNS)
    return inject_errors(df, records, seed)


def inject_errors(df: pd.DataFrame, records: int, seed: int) -> pd.DataFrame:
    """Agrega los defectos que la limpieza debe resolver: nulos, atípicos, formato y duplicados."""

    def sample(fraction: float) -> np.ndarray:
        return np.random.choice(df.index, size=int(records * fraction), replace=False)

    df.loc[sample(0.04), "dispositivo_afectado"] = np.nan
    df.loc[sample(0.04), "tiempo_resolucion_horas"] = np.nan
    df.loc[sample(0.005), "tiempo_resolucion_horas"] = -15.0
    # Igual que el original: el lado derecho usa otros índices y pandas alinea por índice,
    # así que casi todas esas filas quedan sin departamento en vez de con formato sucio.
    # Python evalúa primero el lado derecho, por eso las fuentes se sortean antes.
    sources = df.loc[sample(0.05), "departamento_asignado"]
    targets = sample(0.05)
    df.loc[targets, "departamento_asignado"] = sources.apply(lambda value: f"   {value.lower()}   ")
    df.loc[sample(0.01), "fecha_creacion"] = "ERROR_REGISTRO_SISTEMA"

    duplicates = df.sample(n=int(records * 0.02), random_state=seed)
    df = pd.concat([df, duplicates], ignore_index=True)
    df = df.sample(frac=1.0, random_state=seed).reset_index(drop=True)

    # Ruido del 5 % en las etiquetas: limita la exactitud alcanzable a cerca de 95 %.
    noisy = np.random.choice(df.index, size=int(len(df) * 0.05), replace=False)
    labels = ["Baja", "Media", "Alta", "Crítica"]
    for index in noisy:
        current = df.loc[index, "prioridad"]
        df.loc[index, "prioridad"] = random.choice([label for label in labels if label != current])
    return df
