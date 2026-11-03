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
| `npm run test:coverage` | Ejecuta las pruebas una vez y exige 90 % de cobertura |
| `npm run lint` | Revisa y corrige el código con Oxlint y [ESLint](https://eslint.org/) |
| `npm run format` | Formatea `src/` con Prettier |

La configuración de Vite se documenta en la [referencia de Vite](https://vite.dev/config/).

### Entorno recomendado

- [VS Code](https://code.visualstudio.com/) con la extensión [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar), sin Vetur.
- Vue.js devtools para [navegadores Chromium](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) o [Firefox](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/), con Custom Object Formatter activado en [Chrome](http://bit.ly/object-formatters) o [Firefox](https://fxdx.dev/firefox-devtools-custom-object-formatters/).

### Tipos en archivos `.vue`

TypeScript no entiende los imports de `.vue` por sí solo, así que la verificación de tipos usa `vue-tsc` en lugar de `tsc`. En el editor, la extensión de Vue se encarga de lo mismo.

## Back

API REST con FastAPI sobre PostgreSQL. Clasifica cada ticket con un modelo de Machine Learning (TF-IDF y Random Forest) entrenado con un dataset sintético de 100,000 tickets, y guarda cada acción en una bitácora de eventos.

Requiere [uv](https://docs.astral.sh/uv/) y Docker o Podman. uv instala Python 3.13 y las dependencias fijadas en `uv.lock`. Todos los comandos se ejecutan dentro de `back/`.

| Carpeta o archivo | Qué contiene |
| --- | --- |
| `app/main.py` | Crea la API, carga el modelo al arrancar y registra los routers |
| `app/config.py` | Configuración leída de variables de entorno o de `.env` |
| `app/models/` | Tablas `users`, `tickets` y `events` |
| `app/routers/` | Endpoints de la API |
| `app/ml/` | Generación del dataset, limpieza, entrenamiento y carga del modelo |
| `app/seeds/` | Semillas `demo` y `completo` |
| `app/cli.py` | Comandos de mantenimiento |
| `migrations/` | Migraciones de Alembic |
| `compose.yaml` | PostgreSQL 17 con las bases `tickets` y `tickets_test` |
| `tests/` | Pruebas con pytest contra la base `tickets_test` |

### Configuración

```sh
cd back
cp .env.example .env              # el .env no se sube al repositorio
docker compose up -d              # o: podman compose up -d
uv sync
uv run alembic upgrade head
```

| Variable | Qué hace |
| --- | --- |
| `DATABASE_URL` | Conexión a PostgreSQL. Es obligatoria: la API no arranca sin ella |
| `TEST_DATABASE_URL` | Base de las pruebas. Debe ser distinta de `DATABASE_URL` |
| `APP_ENV` | `development`, `test` o `production`. En producción no se pueden cargar semillas |
| `APP_NOW` | Hora fija de la demo (`2026-10-28T11:42:10-06:00`), la misma que usa el front. Vacía para usar el reloj real |
| `TIMEZONE` | Zona horaria de la mesa de ayuda, `America/Mexico_City` por omisión |
| `DATA_DIR`, `MODEL_PATH` | Carpeta del dataset y ruta del modelo. Por omisión, `back/datos/` |
| `CORS_ORIGINS` | Orígenes que pueden llamar a la API, en JSON |

### Datos y modelo

El dataset y el modelo no se versionan: viven en `back/datos/`, que git ignora, y se regeneran con un solo comando. La generación y el entrenamiento fijan la semilla `42`, así que siempre producen los mismos archivos.

```sh
uv run python -m app.ml.train     # unos 40 s
```

| Archivo | Qué es |
| --- | --- |
| `tickets_soporte.csv` | Dataset bruto: 102,000 filas con duplicados, nulos, fechas corruptas y tiempos atípicos a propósito |
| `tickets_soporte_procesado.csv` | Dataset limpio: 99,209 filas |
| `modelo_tickets.joblib` | Modelo entrenado, comprimido (unos 18 MB) |
| `metricas.json` | Exactitud, métricas por clase, matriz de confusión, división 70/15/15, limpieza y parámetros |

La API solo carga un modelo entrenado con la misma versión de scikit-learn que tiene instalada. Si no hay modelo o es de otra versión, arranca igual y lo informa en `GET /api/model/info`.

### Semillas

Cada semilla borra todos los datos antes de cargar.

```sh
uv run python -m app.cli seed demo       # 4 usuarios, 9 tickets y 31 eventos del prototipo
uv run python -m app.cli seed completo   # la demo más 98,999 tickets históricos resueltos (~30 s)
```

La semilla `completo` necesita `tickets_soporte_procesado.csv` en `back/datos/`. El CSV tiene 99,209 filas pero 99,000 IDs distintos, y `TCK-115796` ya viene en la demo, así que se cargan 98,999.

### Desarrollo y pruebas

```sh
uv run fastapi dev app/main.py    # API en http://localhost:8000, documentación en /docs
uv run ruff check                 # lint
uv run ruff format                # formato
uv run pytest --cov               # pruebas; exige 90 % de cobertura
```

Las pruebas usan `TEST_DATABASE_URL`: borran esa base y la migran desde cero al empezar.

### Endpoints

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `GET` | `/api/health` | Estado de la API, de la base de datos y del modelo, con la hora del servidor |
| `GET` | `/api/model/info` | Si el modelo está cargado, cuándo se entrenó, con qué versión y su exactitud |

## Integración continua

GitHub Actions corre en cada PR hacia `dev` y `main`:

- **Front:** lint, pruebas con cobertura y build.
- **Back:** Ruff y pytest contra PostgreSQL.

El resumen de cada ejecución muestra la cobertura de los dos servicios.
