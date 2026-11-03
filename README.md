# TicketsIA_6-7

Sistema de Tickets de Soporte Técnico del Instituto Tecnológico de Veracruz. Clasifica tickets de soporte con Machine Learning y analiza su texto con PNL.

## Estructura

- [`front/`](front/): aplicación web con Vue 3, Vite y TypeScript.
- [`back/`](back/): API REST con FastAPI, PostgreSQL y el modelo de clasificación.

## Front

Requiere Node `^22.18.0` o `>=24.12.0`. Todos los comandos se ejecutan dentro de `front/`.

```sh
cd front
npm install
```

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo con recarga en caliente |
| `npm run build` | Verifica tipos y compila para producción |
| `npm run preview` | Sirve localmente el build de producción |
| `npm run test:unit` | Ejecuta las pruebas unitarias con [Vitest](https://vitest.dev/) |
| `npm run lint` | Revisa y corrige el código con Oxlint y [ESLint](https://eslint.org/) |
| `npm run format` | Formatea `src/` con Prettier |

La configuración de Vite se documenta en la [referencia de Vite](https://vite.dev/config/).

### Entorno recomendado

- [VS Code](https://code.visualstudio.com/) con la extensión [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar), sin Vetur.
- Vue.js devtools para [navegadores Chromium](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) o [Firefox](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/), con Custom Object Formatter activado en [Chrome](http://bit.ly/object-formatters) o [Firefox](https://fxdx.dev/firefox-devtools-custom-object-formatters/).

### Tipos en archivos `.vue`

TypeScript no entiende los imports de `.vue` por sí solo, así que la verificación de tipos usa `vue-tsc` en lugar de `tsc`. En el editor, la extensión de Vue se encarga de lo mismo.

## Back

API REST con FastAPI que guarda los tickets en PostgreSQL mediante SQLAlchemy. Al registrar un ticket, analiza la descripción con PNL y el modelo de Machine Learning para asignar la prioridad (Crítica, Alta, Media, Baja) y el departamento, y detectar el sentimiento. Cada acción queda en una bitácora de eventos.

| Archivo | Qué hace |
| --- | --- |
| `main.py` | Levanta la API: CORS, carga del modelo, análisis PNL y ML, y todos los endpoints |
| `database.py` | Conecta con PostgreSQL usando las variables de `.env` |
| `models.py` | Tablas `tickets` (con el análisis del modelo en una columna JSONB) y `events` (bitácora) |
| `cargar_csv.py` | Carga inicial: lee el dataset procesado, quita duplicados e inserta los tickets en PostgreSQL |
| `scripts_ml/` | Scripts para generar el dataset, limpiarlo, entrenar el modelo y probarlo |

### Configuración

Todos los comandos se ejecutan dentro de `back/`. Copia `.env.example` como `.env` y llena los datos de tu PostgreSQL (`DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`). El `.env` no se sube al repositorio.

```sh
cd back
pip install -r requirements.txt
python cargar_csv.py
uvicorn main:app --reload
```

### Datos y modelo

El dataset es sintético. Ni él ni el modelo se versionan porque pesan cerca de 150 MB: viven en `back/datos/`, que git ignora, y se regeneran con los scripts. La generación y el entrenamiento fijan la semilla `42`, así que el resultado siempre es el mismo.

```sh
cd back/datos
python ../scripts_ml/dataset_sintetico.py   # genera tickets_soporte.csv
python ../scripts_ml/limpieza_masiva.py     # genera tickets_soporte_procesado.csv
python ../scripts_ml/entrenamiento_ml.py    # genera modelo_tickets.joblib
```

Por ahora `main.py` y `cargar_csv.py` buscan estos archivos directamente en `back/`, no en `back/datos/`.

### Endpoints

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `GET` | `/` | Comprueba que la API responda |
| `POST` | `/api/auth/login` | Inicia sesión con usuario y contraseña, y devuelve el usuario con su rol |
| `GET` | `/api/tickets` | Lista paginada con filtros `status`, `priority`, `search`, `page` y `pageSize` (10 por omisión). Sin `status` excluye los resueltos |
| `GET` | `/api/tickets/{ticket_id}` | Detalle de un ticket con su análisis |
| `POST` | `/api/tickets` | Crea un ticket y lo clasifica con el modelo |
| `PUT` | `/api/tickets/{ticket_id}` | Cambia estado, técnico, prioridad o solución, y registra cada cambio en la bitácora |
| `GET` | `/api/events` | Lista paginada de eventos, filtrable por `ticketId` |
| `GET` | `/api/tickets/{ticket_id}/events` | Historial de un ticket en orden cronológico |
| `GET` | `/api/model/metrics` | Métricas globales del modelo (por ahora, un `accuracy` fijo) |
| `GET` | `/api/model/info` | Estado del motor de inferencia (por ahora, un texto fijo) |

Ejemplo para crear un ticket:

```json
{
  "area": "Sistemas",
  "reporter": "Nombre del usuario",
  "description": "Falló el servidor de base de datos con error DEADLOCK_DB",
  "device": "Base de Datos"
}
```

Ejemplo para resolverlo:

```json
{
  "status": "Resuelto",
  "solution": "Se reinició el servicio y se aplicó parche de memoria.",
  "resolutionHours": 1.5,
  "updatedBy": "Roberto García Hernández"
}
```
