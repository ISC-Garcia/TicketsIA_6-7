import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta

# ==========================================
# CONFIGURACIÓN DE ESCALA
# ==========================================
N_REGISTROS = 100000
FECHA_FIN = datetime(2026, 10, 7, 12, 0, 0)
FECHA_INICIO = FECHA_FIN - timedelta(days=365)
delta_segundos = int((FECHA_FIN - FECHA_INICIO).total_seconds())

random.seed(42)
np.random.seed(42)

areas = ['Ventas', 'Contabilidad', 'Recursos Humanos', 'Sistemas', 'Operaciones', 'Dirección']
dept_criticos = ['Infraestructura Cloud', 'Seguridad Informática', 'Redes y Conectividad']
dept_menores = ['Hardware y Soporte Local', 'Soporte de Aplicaciones']

dispositivos_criticos = ["Servidor Ubuntu", "Base de Datos", "Firewall", "Switch Core", "Cluster K8s"]
dispositivos_altos = ["Gateway VPN", "Servidor Web", "Storage SAN", "Router Sucursal", "Active Directory"]
dispositivos_medios = ["Impresora de Red", "Paquetería Office", "Monitor Principal", "Acceso a Carpeta", "Sistema Contable"]
dispositivos_bajos = ["Teclado Inalámbrico", "Mouse Óptico", "Diadema", "Cable HDMI", "Funda de Laptop"]

codigos_criticos = ["KERNEL_PANIC", "DEADLOCK_DB", "DDOS_ATTACK", "HARDWARE_FAILURE"]
codigos_altos = ["TIMEOUT_504", "SSL_EXPIRED", "AUTH_401", "HIGH_LATENCY"]

plantillas_criticas = ["El {disp} se encuentra completamente fuera de servicio por {err}.", "Caída total y pérdida de ping hacia el nodo principal del {disp} con alerta {err}."]
impactos_criticos = ["Esto detiene la facturación y la operación de toda la empresa a nivel nacional.", "Todo el personal está paralizado sin poder acceder a los sistemas core."]
tonos_criticos = ["La resolución es de máxima prioridad. El SLA está siendo vulnerado gravemente.", "Requerimos escalamiento inmediato a nivel directivo. Pérdidas económicas activas."]

plantillas_altas = ["Detectamos lentitud extrema y desconexiones esporádicas en el {disp} marcando {err}.", "El servicio del {disp} está degradado afectando a múltiples usuarios concurrentes por {err}."]
impactos_altos = ["Un grupo importante de usuarios externos no puede completar sus transacciones.", "El cierre mensual contable está en riesgo de retraso significativo."]
tonos_altos = ["Urge intervención del equipo de infraestructura antes de que se vuelva crítico.", "Solicitamos revisión prioritaria en el transcurso del turno."]

plantillas_medias = ["Tengo problemas para utilizar la {disp} en mi estación de trabajo.", "El sistema reporta un fallo menor al intentar acceder a la {disp}."]
impactos_medios = ["Esto retrasa ligeramente mi reporte individual de hoy.", "No puedo imprimir los recibos físicos, pero los tengo en digital."]
tonos_medios = ["Quedo a la espera de que soporte local pueda conectarse a mi equipo.", "Favor de agendar una revisión cuando haya un técnico disponible."]

plantillas_bajas = ["Requiero un reemplazo o revisión física de mi {disp} por desgaste.", "Quisiera solicitar asesoría rápida sobre la configuración de mi {disp}."]
impactos_bajos = ["Puedo seguir trabajando sin problemas, es solo para mejorar mi ergonomía.", "Es una duda general que no afecta mi desempeño operativo diario."]
tonos_bajos = ["Agradezco su apoyo sin prisa alguna. Buen día.", "Cuando tengan un espacio libre me avisan, gracias por la ayuda."]

# Plantillas de "RUIDO" para confundir al modelo (~5% de los casos)
ruido_sintoma = ["No sé qué pasa con el {disp}, a veces falla.", "Creo que se descompuso el {disp}.", "Revisen el {disp} por favor."]
ruido_impacto = ["No puedo trabajar.", "Afecta mi día en la oficina.", "Es muy molesto tener que reportar esto."]
ruido_tono = ["Ayuda por favor.", "Urgente que lo revisen.", "Gracias de antemano."]

es_prioridad_array = np.random.choice(['Crítica', 'Alta', 'Media', 'Baja'], size=N_REGISTROS, p=[0.15, 0.20, 0.35, 0.30])
segundos_aleatorios = np.random.randint(0, delta_segundos, size=N_REGISTROS)

filas = []
for i in range(N_REGISTROS):
    fecha_dt = FECHA_INICIO + timedelta(seconds=int(segundos_aleatorios[i]))
    fecha_str = fecha_dt.strftime("%Y-%m-%d %H:%M:%S")
    area = random.choice(areas)
    prioridad = es_prioridad_array[i]
    
    # 5% de probabilidad de generar un ticket ambiguo/trampa
    es_ambiguo = random.random() < 0.05
    
    if prioridad == 'Crítica':
        disp = random.choice(dispositivos_criticos)
        err = random.choice(codigos_criticos)
        sintoma = random.choice(plantillas_criticas).format(disp=disp, err=err) if not es_ambiguo else random.choice(ruido_sintoma).format(disp=disp)
        impacto = random.choice(impactos_criticos) if not es_ambiguo else random.choice(ruido_impacto)
        tono = random.choice(tonos_criticos) if not es_ambiguo else random.choice(ruido_tono)
        dept = random.choice(dept_criticos)
        sentimiento = "Negativo" if not es_ambiguo else "Neutral"
        t_res = round(random.uniform(0.5, 4.0), 2)
    elif prioridad == 'Alta':
        disp = random.choice(dispositivos_altos)
        err = random.choice(codigos_altos)
        sintoma = random.choice(plantillas_altas).format(disp=disp, err=err) if not es_ambiguo else random.choice(ruido_sintoma).format(disp=disp)
        impacto = random.choice(impactos_altos) if not es_ambiguo else random.choice(ruido_impacto)
        tono = random.choice(tonos_altos) if not es_ambiguo else random.choice(ruido_tono)
        dept = random.choice(dept_criticos)
        sentimiento = "Negativo" if not es_ambiguo else "Positivo"
        t_res = round(random.uniform(2.0, 12.0), 2)
    elif prioridad == 'Media':
        disp = random.choice(dispositivos_medios)
        sintoma = random.choice(plantillas_medias).format(disp=disp) if not es_ambiguo else random.choice(ruido_sintoma).format(disp=disp)
        impacto = random.choice(impactos_medios) if not es_ambiguo else random.choice(ruido_impacto)
        tono = random.choice(tonos_medios) if not es_ambiguo else random.choice(ruido_tono)
        dept = random.choice(dept_menores)
        sentimiento = "Neutral" if not es_ambiguo else "Negativo"
        t_res = round(random.uniform(12.0, 48.0), 2)
    else:
        disp = random.choice(dispositivos_bajos)
        sintoma = random.choice(plantillas_bajas).format(disp=disp) if not es_ambiguo else random.choice(ruido_sintoma).format(disp=disp)
        impacto = random.choice(impactos_bajos) if not es_ambiguo else random.choice(ruido_impacto)
        tono = random.choice(tonos_bajos) if not es_ambiguo else random.choice(ruido_tono)
        dept = random.choice(dept_menores)
        sentimiento = random.choice(["Neutral", "Positivo"]) if not es_ambiguo else "Negativo"
        t_res = round(random.uniform(24.0, 96.0), 2)
        
    descripcion = f"{sintoma} {impacto} {tono}"
    filas.append([f"TCK-{100000 + i + 1}", fecha_str, area, disp, descripcion, dept, sentimiento, prioridad, t_res])

df = pd.DataFrame(filas, columns=['id_ticket', 'fecha_creacion', 'area_solicitante', 'dispositivo_afectado', 'descripcion_problema', 'departamento_asignado', 'sentimiento', 'prioridad', 'tiempo_resolucion_horas'])

# Inyección de errores base
df.loc[np.random.choice(df.index, size=int(N_REGISTROS * 0.04), replace=False), 'dispositivo_afectado'] = np.nan
df.loc[np.random.choice(df.index, size=int(N_REGISTROS * 0.04), replace=False), 'tiempo_resolucion_horas'] = np.nan
df.loc[np.random.choice(df.index, size=int(N_REGISTROS * 0.005), replace=False), 'tiempo_resolucion_horas'] = -15.0
df.loc[np.random.choice(df.index, size=int(N_REGISTROS * 0.05), replace=False), 'departamento_asignado'] = df.loc[np.random.choice(df.index, size=int(N_REGISTROS * 0.05), replace=False), 'departamento_asignado'].apply(lambda x: f"   {x.lower()}   ")
df.loc[np.random.choice(df.index, size=int(N_REGISTROS * 0.01), replace=False), 'fecha_creacion'] = "ERROR_REGISTRO_SISTEMA"

df_duplicados = df.sample(n=int(N_REGISTROS * 0.02), random_state=42)
df = pd.concat([df, df_duplicados], ignore_index=True)
df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)

# Además inyectaremos un 5% de ruido histórico en las ETIQUETAS para forzar un Accuracy ~95%
n_noise = int(len(df) * 0.05)
idx_noise = np.random.choice(df.index, size=n_noise, replace=False)
posibles = ['Baja', 'Media', 'Alta', 'Crítica']
for idx in idx_noise:
    actual = df.loc[idx, 'prioridad']
    df.loc[idx, 'prioridad'] = random.choice([p for p in posibles if p != actual])

df.to_csv('tickets_soporte.csv', index=False, encoding='utf-8')
print(f"Archivo 'tickets_soporte.csv' generado exitosamente con ruido (Accuracy esperado ~95%).")