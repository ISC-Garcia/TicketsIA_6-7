import pandas as pd
import re

print("Iniciando motor NLP...")
# Cargar el dataset real
df = pd.read_csv('tickets_soporte_procesado.csv')

# Funciones del Pipeline PNL
def limpiar_y_tokenizar(texto):
    # Stopwords básicas en español
    stopwords = {'en', 'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'por', 'para', 'con', 'de', 'del', 'a', 'mi', 'que', 'se', 'no', 'es', 'al', 'los', 'su'}
    # Extraer solo palabras limpias (Tokenización)
    palabras = re.findall(r'\b[a-zA-ZáéíóúÁÉÍÓÚñÑ]{4,}\b', str(texto).lower())
    tokens = [p for p in palabras if p not in stopwords]
    return tokens

def extraer_entidades(texto):
    entidades = {'Hardware/Software': [], 'Codigos_Error': []}
    # NER para Códigos de error técnicos
    errores = re.findall(r'\b[A-Z]+_[A-Z0-9_]+\b', str(texto))
    if errores: entidades['Codigos_Error'].extend(errores)
    # NER para Dispositivos
    catalogo = ['Paquetería Office', 'Gateway VPN', 'Active Directory', 'Storage SAN', 'Teclado Inalámbrico', 'Funda de Laptop']
    for dev in catalogo:
        if dev.lower() in str(texto).lower(): entidades['Hardware/Software'].append(dev)
    return entidades

def detectar_intencion(texto):
    texto_lower = str(texto).lower()
    if any(palabra in texto_lower for palabra in ['reemplazo', 'física', 'desgaste', 'nuevo']):
        return "SOLICITUD DE HARDWARE"
    elif any(palabra in texto_lower for palabra in ['duda', 'cómo', 'ayuda']):
        return "CONSULTA GENERAL"
    else:
        return "REPORTE DE INCIDENTE"

print("\n" + "="*70)
print(" PIPELINE DE PROCESAMIENTO DE LENGUAJE NATURAL (PNL) ACTIVO")
print("="*70)

# Filtrar 3 tickets interesantes para la demostración
muestra = df[df['descripcion_problema'].str.contains(r'HIGH_LATENCY|desgaste|Office', regex=True, na=False)].drop_duplicates(subset='sentimiento').head(3)

for index, row in muestra.iterrows():
    texto = row['descripcion_problema']
    tokens = limpiar_y_tokenizar(texto)
    
    print(f"\n[Ticket ID]: #{row['id_ticket']}")
    print(f"[Texto Original]: \"{texto}\"")
    print("-" * 50)
    print(f"1. Preprocesamiento (Tokens) : {tokens[:5]}...") # Mostramos primeros 5 tokens
    print(f"2. Extracción de Entidades : {extraer_entidades(texto)}")
    print(f"3. Sentimiento Detectado   : {row['sentimiento'].upper()}")
    print(f"4. Palabras Clave Extraídas: {list(set(tokens))[:3]}")
    print(f"5. Intención del Usuario   : {detectar_intencion(texto)}")
    print("="*70)