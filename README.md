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
| `npm run test:e2e` | Ejecuta las pruebas E2E con Playwright contra la API real (ver abajo) |

La configuración de Vite se documenta en la [referencia de Vite](https://vite.dev/config/).

### Conexión con la API

En desarrollo el front llama a `/api` en su propio origen y Vite lo reenvía a `http://localhost:8000`; para otro destino, inicia con `API_PROXY=http://otra:puerto npm run dev`. Las variables van en `front/.env.local` (ver `.env.example`):

| Variable | Qué hace |
| --- | --- |
| `VITE_API_URL` | URL de la API en producción. Vacía en desarrollo |
| `VITE_API_MOCK` | `true` para trabajar sin back: [MSW](https://mswjs.io/) responde con los datos de `src/mocks/` |
| `VITE_MOCK_FAILURE` | Con `VITE_API_MOCK=true`, hace fallar todas las llamadas para probar los estados de error |
| `VITE_DEMO_MODE` | Muestra los accesos de demostración en el login |

Las pruebas unitarias usan siempre MSW: no necesitan el back.

Si el login dice "No se pudo conectar con el servidor.", la API no está corriendo en el puerto 8000 (`uv run fastapi dev app/main.py` en `back/`). Después de actualizar la rama, reinicia `npm run dev` para que tome los cambios de `vite.config.ts`.

### Pruebas E2E

`npm run test:e2e` levanta la API con `APP_ENV=test` en el puerto 8100 contra la base `tickets_e2e`, levanta el front en el 5180 y corre Playwright en Chromium y Firefox. Antes de cada prueba la API recarga la semilla demo. Necesita PostgreSQL arriba (`back/compose.yaml`) y, la primera vez, los navegadores:

```sh
npx playwright install chromium firefox
npm run test:e2e
```

Otra base se indica con `E2E_DATABASE_URL`. Si una prueba falla, Playwright guarda la traza, la captura y el video en `test-results/`.

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
| `app/ml/` | Generación del dataset, limpieza, entrenamiento, carga del modelo y PNL (`pnl.py`: dispositivos, códigos de error, palabras clave e intención) |
| `app/seeds/` | Semillas `demo` y `completo` |
| `app/cli.py` | Comandos de mantenimiento |
| `migrations/` | Migraciones de Alembic |
| `compose.yaml` | PostgreSQL 17 con las bases `tickets`, `tickets_test` (pytest) y `tickets_e2e` (Playwright) |
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
| `JWT_SECRET` | Clave que firma las sesiones, de al menos 32 caracteres. Obligatoria |
| `SESSION_HOURS` | Horas que dura una sesión, 8 por omisión |

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
uv run python -m app.cli seed demo       # 4 usuarios (contraseña demo2026), 9 tickets y 31 eventos
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

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Público | Estado de la API, de la base de datos y del modelo, con la hora del servidor |
| `POST` | `/api/auth/login` | Público | Recibe `username` y `password`; devuelve `token` y `user`. Registra "Inicio de sesión" |
| `POST` | `/api/auth/logout` | Con sesión | Registra "Cierre de sesión" |
| `GET` | `/api/auth/me` | Con sesión | Usuario de la sesión |
| `GET` | `/api/model/info` | Con sesión | Si el modelo está cargado, cuándo se entrenó, con qué versión y su exactitud |
| `GET` | `/api/tickets` | Técnico, coordinador | Bandeja: filtros `priority`, `department`, `status`, `date` (`hoy`, `48`, `7`) y `search`; `page` y `pageSize` (25 por omisión, máximo 100). Ordena por prioridad y antigüedad. Sin `status` excluye los resueltos |
| `GET` | `/api/tickets/counts` | Técnico, coordinador | Tickets por prioridad; `resolved=true` cuenta los resueltos |
| `GET` | `/api/tickets/{id}` | Con sesión | Detalle de un ticket |
| `GET` | `/api/tickets/{id}/events` | Con sesión | Historial del ticket en orden cronológico |

Las respuestas usan los nombres de campo de `front/src/types/` y las fechas en hora local de la mesa de ayuda (`TIMEZONE`), sin zona, como `2026-10-28 09:57`. Los tickets históricos no traen `technician` ni `analysis`.

El token va en el encabezado `Authorization: Bearer <token>`. Sin token o con uno vencido la API responde 401; con un rol sin permiso, 403. Un usuario desactivado pierde la sesión en su siguiente petición. Los errores siempre llegan como `{ "detail": "..." }` en español, y los de validación agregan `errors` con el campo y el mensaje.

Con `APP_ENV=test` existen además `POST /api/test/reset`, que recarga la semilla demo, y `PATCH /api/test/users/{username}`, que activa o desactiva una cuenta. Los usan las pruebas E2E.

## Integración continua

GitHub Actions corre en cada PR hacia `dev` y `main`:

- **Front:** lint, pruebas con cobertura y build.
- **Back:** Ruff y pytest contra PostgreSQL.
- **E2E:** Playwright en Chromium y Firefox contra la API y PostgreSQL. Si falla, el reporte queda como artefacto de la ejecución.

El resumen de cada ejecución muestra la cobertura de los dos servicios.
