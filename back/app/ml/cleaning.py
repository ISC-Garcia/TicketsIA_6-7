"""Limpieza del dataset bruto (antes `scripts_ml/limpieza_masiva.py`)."""

import numpy as np
import pandas as pd

CORRUPT_DATE = "ERROR_REGISTRO_SISTEMA"
MAX_RESOLUTION_HOURS = 120
DEPARTMENTS = {
    "redes y conectividad": "Redes y Conectividad",
    "hardware y soporte local": "Hardware y Soporte Local",
    "seguridad informática": "Seguridad Informática",
    "infraestructura cloud": "Infraestructura Cloud",
    "soporte de aplicaciones": "Soporte de Aplicaciones",
}


def outliers(hours: pd.Series) -> pd.Series:
    return (hours < 0) | (hours > MAX_RESOLUTION_HOURS)


def impute_department(row: pd.Series) -> str:
    if pd.isna(row["departamento_asignado"]):
        critical = row["prioridad"] in ("Crítica", "Alta")
        return "Infraestructura Cloud" if critical else "Soporte de Aplicaciones"
    return row["departamento_asignado"]


def clean(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """Devuelve el dataset limpio y el conteo de cada defecto encontrado."""
    report = {
        "rawRecords": len(raw),
        "duplicates": int(raw.duplicated().sum()),
        "corruptDates": int((raw["fecha_creacion"] == CORRUPT_DATE).sum()),
        "missingDevices": int(raw["dispositivo_afectado"].isna().sum()),
        "missingHours": int(raw["tiempo_resolucion_horas"].isna().sum()),
        "outlierHours": int(outliers(raw["tiempo_resolucion_horas"]).sum()),
    }

    df = raw.drop_duplicates()
    df["fecha_creacion"] = pd.to_datetime(df["fecha_creacion"], errors="coerce")
    df = df.dropna(subset=["fecha_creacion"])

    departments = df["departamento_asignado"].astype(str).str.strip().str.lower()
    departments = departments.replace(["nan", "none", "null", ""], np.nan)
    df["departamento_asignado"] = departments.map(DEPARTMENTS)
    df["departamento_asignado"] = df.apply(impute_department, axis=1)

    df.loc[outliers(df["tiempo_resolucion_horas"]), "tiempo_resolucion_horas"] = np.nan
    df["dispositivo_afectado"] = df["dispositivo_afectado"].fillna("Sin Especificar")
    df["tiempo_resolucion_horas"] = df.groupby("prioridad")["tiempo_resolucion_horas"].transform(
        lambda hours: hours.fillna(hours.median())
    )

    report["cleanRecords"] = len(df)
    return df, report
