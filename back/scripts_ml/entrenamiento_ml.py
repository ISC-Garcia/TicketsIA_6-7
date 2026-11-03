import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, accuracy_score
import joblib

print("Cargando dataset procesado...")
df = pd.read_csv('tickets_soporte_procesado.csv')

# Definir variables predictoras (X) y objetivo (y)
X = df[['descripcion_problema', 'area_solicitante', 'dispositivo_afectado', 'departamento_asignado', 'sentimiento']]
y = df['prioridad']

print("Dividiendo datos (70% Entrenamiento, 15% Evaluación, 15% Pruebas)...")
# 1. Separar el 70% para entrenamiento y el 30% restante temporal
X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.30, random_state=42, stratify=y)

# 2. Dividir el 30% temporal a la mitad para obtener 15% evaluación y 15% pruebas
X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp)

print(f" -> Registros de entrenamiento: {len(X_train)}")
print(f" -> Registros de evaluación: {len(X_val)}")
print(f" -> Registros de pruebas: {len(X_test)}")

print("\nConfigurando transformadores de texto y categorías...")
transformador = ColumnTransformer(
    transformers=[
        ('texto', TfidfVectorizer(max_features=1000), 'descripcion_problema'),
        ('categorias', OneHotEncoder(handle_unknown='ignore'), ['area_solicitante', 'dispositivo_afectado', 'departamento_asignado', 'sentimiento'])
    ])

# Construcción del pipeline
pipeline_modelo = Pipeline(steps=[
    ('preprocesamiento', transformador),
    ('clasificador', RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42, n_jobs=-1))
])

print("Entrenando el modelo de Random Forest (esto puede tomar unos segundos)...")
pipeline_modelo.fit(X_train, y_train)

print("\n" + "="*50)
print("RESULTADOS DE LA EVALUACIÓN (CONJUNTO DE PRUEBAS - 15%)")
print("="*50)
y_pred = pipeline_modelo.predict(X_test)
print(f"Exactitud General (Accuracy): {accuracy_score(y_test, y_pred) * 100:.2f}%\n")
print("Reporte de Clasificación (Precision, Recall, F1-Score):")
print(classification_report(y_test, y_pred))

print("\nGuardando el modelo entrenado en 'modelo_tickets.joblib'...")
joblib.dump(pipeline_modelo, 'modelo_tickets.joblib')
print("¡Modelo guardado exitosamente!")

# ==========================================
# GENERACIÓN DE LA MATRIZ DE CONFUSIÓN VISUAL
# ==========================================
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix

print("\nGenerando gráfica de Matriz de Confusión...")
# y_test y y_pred ya fueron calculados arriba
cm = confusion_matrix(y_test, y_pred, labels=['Alta', 'Baja', 'Crítica', 'Media'])

plt.figure(figsize=(8,6))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
            xticklabels=['Alta', 'Baja', 'Crítica', 'Media'], 
            yticklabels=['Alta', 'Baja', 'Crítica', 'Media'])
plt.title('Matriz de Confusión - Random Forest')
plt.ylabel('Prioridad Real')
plt.xlabel('Prioridad Predicha')

# Aqui abriremos una ventana con la gráfica
plt.show()