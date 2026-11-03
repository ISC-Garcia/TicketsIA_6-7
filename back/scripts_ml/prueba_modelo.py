import pandas as pd
import joblib

# Cargar el modelo que ya entrenamos
print("Cargando modelo...")
modelo = joblib.load('modelo_tickets.joblib')

# Inventar un ticket nuevo (como si un usuario lo acabara de reportar)
nuevo_ticket = pd.DataFrame({
    'descripcion_problema': ['El servidor principal se apagó y nadie tiene acceso a la base de datos de contabilidad. Urgente.'],
    'area_solicitante': ['Contabilidad'],
    'dispositivo_afectado': ['Servidor Ubuntu'],
    'departamento_asignado': ['Infraestructura Cloud'],
    'sentimiento': ['Negativo']
})

# Hacer la predicción
prioridad_predicha = modelo.predict(nuevo_ticket)

print("\n" + "="*50)
print(f"Ticket reportado: {nuevo_ticket['descripcion_problema'][0]}")
print(f"--> PRIORIDAD ASIGNADA POR LA IA: {prioridad_predicha[0].upper()}")
print("="*50)