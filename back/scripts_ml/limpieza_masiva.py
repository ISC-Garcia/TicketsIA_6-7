import pandas as pd
import numpy as np

# 1. Carga del archivo sin procesar
print("Cargando dataset bruto...")
df_clean = pd.read_csv('tickets_soporte.csv')

print("\n" + "="*50)
print("DIAGNÓSTICO INICIAL (PRE-PROCESAMIENTO)")
print("="*50)
print(f"Total registros cargados: {len(df_clean)}")
print(f"Registros duplicados: {df_clean.duplicated().sum()}")
print(f"Fechas corruptas identificadas: {(df_clean['fecha_creacion'] == 'ERROR_REGISTRO_SISTEMA').sum()}")
print(f"Nulos en dispositivo_afectado: {df_clean['dispositivo_afectado'].isna().sum()}")
print(f"Nulos en tiempo_resolucion_horas: {df_clean['tiempo_resolucion_horas'].isna().sum()}")
outliers_iniciales = ((df_clean['tiempo_resolucion_horas'] < 0) | (df_clean['tiempo_resolucion_horas'] > 120)).sum()
print(f"Valores atípicos en tiempo (<0h o >120h): {outliers_iniciales}")

# ==========================================
# RUTINA DE LIMPIEZA Y PREPARACIÓN MASIVA
# ==========================================

# A. Eliminación inmediata de duplicados exactos
df_clean.drop_duplicates(inplace=True)

# B. Conversión estandarizada de fechas y descarte de registros no recuperables
df_clean['fecha_creacion'] = pd.to_datetime(df_clean['fecha_creacion'], errors='coerce')
df_clean.dropna(subset=['fecha_creacion'], inplace=True)

# C. Normalización y corrección completa de departamento_asignado
df_clean['departamento_asignado'] = df_clean['departamento_asignado'].astype(str).str.strip().str.lower()
df_clean['departamento_asignado'] = df_clean['departamento_asignado'].replace(['nan', 'none', 'null', ''], np.nan)

mapeo_dept = {
    'redes y conectividad': 'Redes y Conectividad',
    'hardware y soporte local': 'Hardware y Soporte Local',
    'seguridad informática': 'Seguridad Informática',
    'infraestructura cloud': 'Infraestructura Cloud',
    'soporte de aplicaciones': 'Soporte de Aplicaciones'
}
df_clean['departamento_asignado'] = df_clean['departamento_asignado'].map(mapeo_dept)

# Imputación inteligente de departamentos faltantes por nivel de urgencia
def imputar_dept(row):
    if pd.isna(row['departamento_asignado']):
        if row['prioridad'] in ['Crítica', 'Alta']:
            return 'Infraestructura Cloud'
        else:
            return 'Soporte de Aplicaciones'
    return row['departamento_asignado']

df_clean['departamento_asignado'] = df_clean.apply(imputar_dept, axis=1)

# D. Tratamiento de valores atípicos (Outliers): aislamiento dentro de rangos operativos
df_clean.loc[(df_clean['tiempo_resolucion_horas'] < 0) | (df_clean['tiempo_resolucion_horas'] > 120), 'tiempo_resolucion_horas'] = np.nan

# E. Imputación inteligente de datos nulos restantes
df_clean['dispositivo_afectado'] = df_clean['dispositivo_afectado'].fillna('Sin Especificar')
df_clean['tiempo_resolucion_horas'] = df_clean.groupby('prioridad')['tiempo_resolucion_horas'].transform(lambda x: x.fillna(x.median()))

# ==========================================
# REPORTE DE RESULTADOS Y EXPORTACIÓN
# ==========================================
print("\n" + "="*50)
print("MÉTRICAS TRAS LA LIMPIEZA (POST-PROCESAMIENTO)")
print("="*50)
print(f"Total registros limpios: {len(df_clean)}")
print(f"Valores nulos totales restantes: {df_clean.isna().sum().sum()}")
print(f"Rango válido de tiempo de resolución: {df_clean['tiempo_resolucion_horas'].min()}h a {df_clean['tiempo_resolucion_horas'].max()}h")
print(f"Departamentos consolidados: {list(df_clean['departamento_asignado'].unique())}")

# Exportar dataset limpio requerido para el Entregable 2
df_clean.to_csv('tickets_soporte_procesado.csv', index=False, encoding='utf-8')
print("\nDataset procesado guardado exitosamente como 'tickets_soporte_procesado.csv'.")