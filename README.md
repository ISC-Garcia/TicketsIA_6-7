# TicketsIA_6-7

Sistema de Tickets de Soporte Técnico del Instituto Tecnológico de Veracruz. Clasifica tickets de soporte con Machine Learning y analiza su texto con PNL.

## Estructura

- [`front/`](front/): aplicación web con Vue 3, Vite y TypeScript.
- [`back/`](back/): API REST con FastAPI, PostgreSQL y el modelo de clasificación.

## Probar en local

Necesitas Node `^22.18.0` o `>=24.12.0`, [uv](https://docs.astral.sh/uv/) y Docker o Podman. Los pasos 1 a 4 solo se hacen la primera vez.

**1. Instalar uv** (si `uv --version` no responde):

```sh
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**2. Configurar el back.** Desde la raíz del repositorio:

```sh
cd back
cp .env.example .env
python3 -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(48))" >> .env
uv sync
```

**3. Levantar PostgreSQL** (crea las bases `tickets`, `tickets_test` y `tickets_e2e`):

```sh
docker compose up -d        # o: podman compose up -d
docker compose ps           # el servicio db debe decir "healthy"
```

**4. Crear las tablas, entrenar el modelo y cargar los datos:**

```sh
uv run alembic upgrade head
uv run python -m app.ml.train            # unos 2 min
uv run python -m app.cli seed completo   # unos 30 s; para algo más ligero: seed demo
```

**5. Iniciar la API** (deja esta terminal abierta):

```sh
uv run fastapi dev app/main.py
```

La API queda en <http://localhost:8000> y su documentación interactiva en <http://localhost:8000/docs>.

**6. Iniciar el front** en otra terminal (la primera vez, `npm install` antes):

```sh
cd front
npm install
npm run dev
```

**7. Entrar.** Abre <http://localhost:5173> y usa cualquiera de estas cuentas, todas con la contraseña `demo2026`:

| Usuario | Rol | Qué puede hacer |
| --- | --- | --- |
| `tecnico` | Técnico (Roberto García) | Registrar, atender y resolver sus tickets |
| `sxala` | Técnico (Sarely Xala) | Lo mismo, con sus propios tickets |
| `coordinador` | Coordinador | Bandeja general y reasignación |
| `auditor` | Auditor | Monitoreo, bitácora e historial (en construcción) |

**8. Correr las pruebas:**

```sh
cd back && uv run pytest --cov           # pruebas del back
cd front && npm run test:coverage        # pruebas unitarias del front
cd front && npx playwright install chromium firefox   # solo la primera vez
cd front && npm run test:e2e             # E2E: levantan su propia API y su propio front
```

Las E2E usan los puertos 8100 y 5180 y la base `tickets_e2e`, así que pueden correr aunque tengas la API y el front de los pasos 5 y 6 abiertos.

**Para detener todo:** `Ctrl+C` en las terminales de la API y del front, y `docker compose down` en `back/`. Los datos se conservan en el volumen; `docker compose down -v` los borra.

**Si algo falla:**

- **"No se pudo conectar con el servidor." en el login:** la API no está corriendo en el puerto 8000 (paso 5). Si acabas de cambiar de rama, reinicia también `npm run dev`.
- **"El modelo de clasificación no está disponible" al registrar:** falta el modelo, o es de otra versión. Repite `uv run python -m app.ml.train`.
- **Las E2E fallan al conectar con `tickets_e2e`:** tu volumen se creó antes de que existiera esa base. Créala una vez con `docker compose exec db psql -U tickets -c "CREATE DATABASE tickets_e2e"`.
- **Después de hacer `git pull`:** corre de nuevo `uv sync`, `uv run alembic upgrade head` y `npm install`.

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
uv run python -m app.ml.train     # unos 2 min
```

| Archivo | Qué es |
| --- | --- |
| `tickets_soporte.csv` | Dataset bruto: 102,000 filas con duplicados, nulos, fechas corruptas y tiempos atípicos a propósito |
| `tickets_soporte_procesado.csv` | Dataset limpio: 99,209 filas |
| `modelo_tickets.joblib` | Los tres clasificadores entrenados (prioridad, departamento y sentimiento), comprimidos (unos 18 MB) |
| `metricas.json` | Exactitud con el departamento y el sentimiento predichos, métricas por clase, matriz de confusión, división 70/15/15, limpieza y parámetros |

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
| `POST` | `/api/auth/password` | Con sesión | Cambia la contraseña (`currentPassword`, `newPassword` de 8 caracteres o más) y entrega una sesión completa; registra "Cambio de contraseña" |
| `GET` | `/api/model/info` | Con sesión | Si el modelo está cargado, cuándo se entrenó, con qué versión y su exactitud |
| `GET` | `/api/model/metrics` | Coordinador | El contenido de `metricas.json` del modelo cargado; 503 si no hay modelo |
| `GET` | `/api/tickets` | Técnico, coordinador | Bandeja: filtros `priority`, `department`, `status`, `date` (`hoy`, `48`, `7`) y `search`; `page` y `pageSize` (25 por omisión, máximo 100). Ordena por prioridad y antigüedad. Sin `status` excluye los resueltos |
| `GET` | `/api/tickets/counts` | Técnico, coordinador | Tickets por prioridad; `resolved=true` cuenta los resueltos |
| `POST` | `/api/tickets/analyze` | Técnico | Clasifica una captura (`area`, `reporter`, `description` de 20 a 1,000 caracteres, `device` opcional) sin guardarla. Responde 503 si no hay modelo |
| `POST` | `/api/tickets` | Técnico | Registra la captura: la vuelve a clasificar, le asigna el siguiente ID (`TCK-200030`, …) y al técnico de la sesión, y registra "Ticket creado" y "Clasificado por IA" |
| `GET` | `/api/tickets/{id}` | Con sesión | Detalle de un ticket |
| `GET` | `/api/tickets/{id}/events` | Con sesión | Historial del ticket en orden cronológico |
| `POST` | `/api/tickets/{id}/attend` | Técnico asignado | Pasa un ticket Abierto a En atención y registra "Cambio de estado" |
| `POST` | `/api/tickets/{id}/resolve` | Técnico asignado | Resuelve un ticket En atención con `solution` (10 caracteres o más) y `resolutionHours` (más de 0); registra "Ticket resuelto" |
| `GET` | `/api/technicians` | Coordinador | Técnicos activos con su número de tickets sin resolver |
| `POST` | `/api/tickets/{id}/assign` | Coordinador | Reasigna un ticket sin resolver a un técnico activo (`technician`); registra "Reasignación" |
| `PATCH` | `/api/tickets/{id}/resolution` | Quien lo resolvió | Corrige `solution` o `resolutionHours` de un ticket resuelto; registra "Edición de datos" posterior al cierre |
| `GET` | `/api/dashboard` | Coordinador | KPI, tickets por prioridad y departamento, tendencia (`period`: `semana`, `mes` o `año`; solo cambia la tendencia), tiempo promedio contra SLA y críticos sin resolver |
| `GET` | `/api/users` | Coordinador | Usuarios con su rol y estado |
| `POST` | `/api/users` | Coordinador | Crea un usuario (`name`, `username` con `^[a-z0-9._]{3,}$`, `role`, `password` temporal de 8 caracteres o más) |
| `PATCH` | `/api/users/{username}` | Coordinador | Activa o desactiva una cuenta (`active`); nadie se desactiva a sí mismo |
| `GET` | `/api/events` | Auditor | Bitácora del más reciente al más antiguo, de 10 en 10. Filtra por `type`, `user`, `date` (`hoy` o `7`), `ticketId` exacto y `afterClose`. Trae además `afterCloseTotal` y los `users` que aparecen en ella |

Las respuestas usan los nombres de campo de `front/src/types/` y las fechas en hora local de la mesa de ayuda (`TIMEZONE`), sin zona, como `2026-10-28 09:57`. Los tickets históricos no traen `technician` ni `analysis`.

El token va en el encabezado `Authorization: Bearer <token>`. Sin token o con uno vencido la API responde 401; con un rol sin permiso, 403. Un usuario desactivado pierde la sesión en su siguiente petición. Un usuario nuevo entra con una contraseña temporal: hasta cambiarla, su token solo sirve para `/api/auth/password`, `/api/auth/me` y `/api/auth/logout`, y el resto responde 403. Los errores siempre llegan como `{ "detail": "..." }` en español, y los de validación agregan `errors` con el campo y el mensaje.

Con `APP_ENV=test` existen además `POST /api/test/reset`, que recarga la semilla demo, y `PATCH /api/test/users/{username}`, que activa o desactiva una cuenta. Los usan las pruebas E2E.

## Integración continua

GitHub Actions corre en cada PR hacia `dev` y `main`:

- **Front:** lint, pruebas con cobertura y build.
- **Back:** Ruff y pytest contra PostgreSQL.
- **E2E:** Playwright en Chromium y Firefox contra la API y PostgreSQL. Si falla, el reporte queda como artefacto de la ejecución.

El resumen de cada ejecución muestra la cobertura de los dos servicios.
