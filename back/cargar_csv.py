import pandas as pd
from database import engine, Base
import models
import os

# 1. Crear las tablas en PostgreSQL si no existen
print("Creando tablas en la base de datos...")
Base.metadata.create_all(bind=engine)

# 2. Ruta al CSV procesado
CSV_PATH = os.path.join(os.path.dirname(__file__), "tickets_soporte_procesado.csv")

if not os.path.exists(CSV_PATH):
    print(f"Error: No se encontró el archivo {CSV_PATH}")
    exit()

print("Cargando CSV con pandas...")
df = pd.read_csv(CSV_PATH)

# 3. Transformar el DataFrame para que coincida con nuestro modelo TicketDB
print("Transformando datos...")
df_db = pd.DataFrame()
df_db['id'] = df['id_ticket'] if 'id_ticket' in df.columns else [f"TCK-1{str(i).zfill(5)}" for i in range(len(df))]
df_db['priority'] = df['prioridad']
df_db['area'] = df['area_solicitante']
df_db['device'] = df['dispositivo_afectado']
df_db['department'] = df['departamento_asignado']
df_db['status'] = df.get('estado', "Abierto")
df_db['createdAt'] = pd.to_datetime(df['fecha_creacion'])
df_db['reporter'] = "Usuario de prueba" # O la columna real si existe
df_db['technician'] = "Sistema"
df_db['summary'] = df['descripcion_problema'].str.slice(0, 60) + "..."
df_db['description'] = df['descripcion_problema']

# Armar el JSON del análisis simulado para el histórico
df_db['analysis'] = df.apply(lambda row: {
    "confidence": float(row.get('confianza', 85.0)),
    "sentiment": str(row.get('sentimiento', 'Neutral')),
    "intent": "Reporte de incidente",
    "keywords": [],
    "devices": [str(row['dispositivo_afectado'])],
    "errorCodes": []
}, axis=1)

# Eliminar cualquier id_ticket duplicado antes de subir a PostgreSQL
df_db = df_db.drop_duplicates(subset=['id'])

# 4. Subir a PostgreSQL masivamente (rápido y eficiente)
print(f"Subiendo {len(df_db)} registros a PostgreSQL... (Esto puede tardar unos minutos)")
df_db.to_sql('tickets', engine, if_exists='append', index=False, dtype={'analysis': models.JSONB})
print("¡Migración de CSV a PostgreSQL completada exitosamente!")