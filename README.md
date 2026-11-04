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

La semilla mueve sus fechas a la hora en que la cargas: los tickets abiertos llegan con unas horas de antigüedad. Si la cargaste hace días, todo aparecerá vencido; vuelve a cargarla para empezar de nuevo.

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
| `auditor` | Auditor | Monitoreo de PostgreSQL, bitácora e historial |

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
- **Después de hacer `git pull`:** corre de nuevo `uv sync`, `uv run alembic upgrade head` y `npm install`. Si cambió `compose.yaml`, recrea la base con `docker compose up -d` (los datos se conservan).
- **La API no arranca y dice "APP_NOW solo se permite con APP_ENV=test":** tu `back/.env` es de una versión anterior. Borra la línea `APP_NOW`.
- **Monitoreo dice que pg_stat_statements no está activa:** la base se levantó antes de que `compose.yaml` la activara. Recréala con `docker compose up -d`.

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
| `VITE_DEMO_MODE` | Muestra los accesos de demostración en el login |

El front siempre habla con la API real y toma su hora de `GET /api/health` al arrancar, así que la fecha, la antigüedad y el SLA coinciden con los del servidor. Solo las pruebas unitarias usan [MSW](https://mswjs.io/) con los datos de `src/mocks/` y una hora fija: no necesitan el back.

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
| `compose.yaml` | PostgreSQL 17 con las bases `tickets`, `tickets_test` (pytest) y `tickets_e2e` (Playwright), y `pg_stat_statements` activa para el monitoreo |
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
| `APP_NOW` | Hora fija, solo con `APP_ENV=test`: la usan pytest y las E2E para obtener siempre los mismos resultados. En desarrollo y producción la API usa el reloj real |
| `TIMEZONE` | Zona horaria de la mesa de ayuda, `America/Mexico_City` por omisión |
| `DATA_DIR`, `MODEL_PATH` | Carpeta del dataset y ruta del modelo. Por omisión, `back/datos/` |
| `CORS_ORIGINS` | Orígenes que pueden llamar a la API, en JSON |
| `JWT_SECRET` | Clave que firma las sesiones, de al menos 32 caracteres. Obligatoria |
| `SESSION_HOURS` | Horas que dura una sesión, 8 por omisión |
| `BACKUP_DIR` | Carpeta de los respaldos de `pg_dump`. Por omisión, `back/datos/respaldos/` |
| `PG_DUMP` | Comando de `pg_dump`, `pg_dump` por omisión. Debe ser de la misma versión que el servidor o más nueva |
| `MONITOR_INTERVAL_MINUTES` | Cada cuántos minutos la API guarda una muestra de PostgreSQL para las gráficas del monitoreo, 5 por omisión. Con 0 no guarda |

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

### Respaldos

```sh
uv run python -m app.cli backup
```

Ejecuta `pg_dump` en formato custom, guarda el archivo en `BACKUP_DIR` y registra el resultado con su duración, su tamaño y su SHA-256. Si falla, lo reintenta una vez. El comando termina con error si el último intento falla. El auditor ve los respaldos de los últimos 7 días en Monitoreo > Respaldos.

### Integridad de los datos

Cada ticket y cada evento guarda la huella SHA-256 de su contenido (`content_sha256`). La calcula `app/integrity.py` en cada escritura de la API, y la migración `0008` la llenó en los registros existentes. En Monitoreo > Tablas, "Verificar integridad" recalcula las huellas de `tickets`, `events` y de los archivos de respaldo, y señala lo que se modificó por fuera de la API. No detecta registros borrados y no usa cadena de bloques.

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
| `GET` | `/api/database/status` | Auditor | Estado real de PostgreSQL: servidor, tiempo activo, conexiones, latencia, consultas por minuto, tamaño, aciertos de caché, gráficas por `period` (`24h`, `semana` o `mes`) y consultas lentas de `pg_stat_statements` |
| `GET` | `/api/database/tables` | Auditor | Tablas con filas, tamaño, fecha de su dato más reciente y columnas, con las descripciones guardadas como `COMMENT ON` |
| `GET` | `/api/database/backups` | Auditor | Respaldos de los últimos 7 días, exitosos y fallidos, con su SHA-256 y el reintento ligado al fallido |
| `GET` | `/api/database/integrity` | Auditor | Recalcula la huella SHA-256 de `tickets`, `events` y de los respaldos exitosos, y devuelve cuántos verificó y cuáles no coinciden |
| `GET` | `/api/events` | Auditor | Bitácora del más reciente al más antiguo, de 10 en 10. Filtra por `type`, `user`, `date` (`hoy` o `7`), `ticketId` exacto y `afterClose`. Trae además `afterCloseTotal` y los `users` que aparecen en ella |

Las respuestas usan los nombres de campo de `front/src/types/` y las fechas en hora local de la mesa de ayuda (`TIMEZONE`), sin zona, como `2026-10-28 09:57`. Los tickets históricos no traen `technician` ni `analysis`.

El token va en el encabezado `Authorization: Bearer <token>`. Sin token o con uno vencido la API responde 401; con un rol sin permiso, 403. Un usuario desactivado pierde la sesión en su siguiente petición. Un usuario nuevo entra con una contraseña temporal: hasta cambiarla, su token solo sirve para `/api/auth/password`, `/api/auth/me` y `/api/auth/logout`, y el resto responde 403. Los errores siempre llegan como `{ "detail": "..." }` en español, y los de validación agregan `errors` con el campo y el mensaje.

Con `APP_ENV=test` existen además estos endpoints, que solo usan las pruebas E2E:

- `POST /api/test/reset` recarga la semilla demo y limpia los intentos de login fallidos.
- `PATCH /api/test/users/{username}` activa o desactiva una cuenta.
- `POST /api/test/backup` ejecuta un respaldo.
- `POST /api/test/tamper/{id}` cambia un ticket directo en la base, para probar la integridad.

### Seguridad

- **Permisos:** cada endpoint declara qué roles lo usan, y `tests/test_permissions.py` falla si aparece uno sin declarar.
- **Contraseñas:** se guardan con argon2. El login responde lo mismo para un usuario inexistente, uno desactivado o una contraseña incorrecta.
- **Intentos de login:** tras 5 intentos fallidos en un minuto con el mismo usuario y desde el mismo cliente, el login responde 429 durante un minuto.
- **Encabezados:** cada respuesta lleva `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y una `Content-Security-Policy` que no permite cargar nada. La única excepción es `/docs`, que carga Swagger.
- **CORS:** solo acepta los orígenes de `CORS_ORIGINS`, los métodos `GET`, `POST` y `PATCH`, y los encabezados `Authorization` y `Content-Type`.
- **Errores:** un error inesperado responde 500 con un mensaje en español y nunca con la traza.
- **Dependencias** (revisadas el 2026-11-03): `pip-audit` no encuentra vulnerabilidades. `npm audit --omit=dev` tampoco; las 19 moderadas que reporta `npm audit` completo están en herramientas de desarrollo.

## Integración continua

GitHub Actions corre en cada PR hacia `dev` y `main`:

- **Front:** lint, pruebas con cobertura y build.
- **Back:** Ruff y pytest contra PostgreSQL.
- **E2E:** Playwright en Chromium y Firefox contra la API y PostgreSQL. Si falla, el reporte queda como artefacto de la ejecución.

El resumen de cada ejecución muestra la cobertura de los dos servicios.

## Desplegar en una máquina virtual

Así está desplegado para la revisión: una instancia `m7i-flex.large` de AWS EC2 (2 vCPU, 8 GB) con Ubuntu 24.04. Funciona igual en cualquier máquina con Ubuntu y 2 GB de RAM o más; la API ocupa unos 420 MB con el modelo cargado.

```text
Internet ──443──> Caddy ──┬── /api/*  → API (uvicorn, 127.0.0.1:8000, systemd)
                          └── resto   → front compilado (/var/www/tickets)
                 API ────> PostgreSQL 17 (Docker, 127.0.0.1:5432)
```

El front y la API comparten dominio, así que no hace falta CORS entre ellos y `VITE_API_URL` va vacía. Caddy obtiene el certificado HTTPS solo. Sin dominio propio sirve `sslip.io`: la IP `77.113.193.240` se escribe `77-113-193-240.sslip.io`.

**1. Abrir los puertos:** 80 y 443 para todo el mundo, y 22 solo para tu IP. El 5432 no se abre.

**2. Instalar el sistema** (en la máquina):

```sh
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 rsync curl gnupg
curl -LsSf https://astral.sh/uv/install.sh | sh
# pg_dump 17 desde el repositorio de PostgreSQL: el de Ubuntu es más viejo que el servidor
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
# Caddy y Node 22
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y postgresql-client-17 caddy nodejs
```

**3. Copiar el código y los datos** (desde tu equipo). El modelo y el CSV no están en git:

```sh
git ls-files > /tmp/archivos.txt
printf "back/datos/modelo_tickets.joblib\nback/datos/metricas.json\nback/datos/tickets_soporte_procesado.csv\n" >> /tmp/archivos.txt
rsync -az --files-from=/tmp/archivos.txt -e "ssh -i llave.pem" ./ ubuntu@<IP>:/home/ubuntu/tickets/
```

**4. Configurar y levantar el back** (en la máquina, en `~/tickets/back`). Crea `back/.env` con claves nuevas; nunca reutilices las de desarrollo:

```sh
DBPASS=$(openssl rand -hex 24)
cat > .env <<EOF
APP_ENV=production
POSTGRES_PASSWORD=$DBPASS
POSTGRES_PORT=127.0.0.1:5432
DATABASE_URL=postgresql://tickets:$DBPASS@localhost:5432/tickets
TIMEZONE=America/Mexico_City
CORS_ORIGINS=["https://<dominio>"]
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
EOF
chmod 600 .env
sudo docker compose up -d                 # PostgreSQL solo en 127.0.0.1
uv sync --no-dev --frozen
uv run --no-dev alembic upgrade head
# Una sola vez: en producción la semilla está bloqueada a propósito.
APP_ENV=development uv run --no-dev python -m app.cli seed completo
```

**5. Servicios, front y Caddy:**

```sh
cd ~/tickets
sudo cp deploy/tickets-api.service deploy/tickets-backup.service deploy/tickets-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tickets-api tickets-backup.timer      # API y respaldo diario a las 03:00
cd front && npm ci && VITE_DEMO_MODE=true npm run build-only        # VITE_DEMO_MODE muestra las cuentas demo
sudo mkdir -p /var/www/tickets && sudo rsync -a --delete dist/ /var/www/tickets/
sed "s/^DOMINIO /<dominio> /" ../deploy/Caddyfile | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**Comprobar:** `curl https://<dominio>/api/health` debe decir `"database":true` y `"modelLoaded":true`.

**Mantenimiento:**

| Para | Comando |
| --- | --- |
| Ver la API | `systemctl status tickets-api` y `journalctl -u tickets-api -f` |
| Respaldar ahora | `sudo systemctl start tickets-backup` |
| Actualizar el código | Repite el paso 3, luego `uv sync --no-dev --frozen`, `alembic upgrade head` y `sudo systemctl restart tickets-api`; para el front, repite su build y su copia |
| Volver a empezar los datos | `APP_ENV=development uv run --no-dev python -m app.cli seed completo` |

Los respaldos quedan en `back/datos/respaldos/` de la máquina: si la borras, se pierden con ella.

## Demo por rol

Con la semilla completa cargada (`uv run python -m app.cli seed completo`), la API y el front en marcha. Todas las cuentas usan `demo2026`.

1. **Técnico (`tecnico`):**
   - En Registrar ticket, escribe una falla, por ejemplo un servidor caído con `KERNEL_PANIC`. Analízala, revisa "¿Por qué esta prioridad?" y confírmala.
   - En la bandeja, atiende un ticket y márcalo como resuelto.
   - Como `sxala`, corrige la resolución de `TCK-115796`.
2. **Coordinador (`coordinador`):**
   - En el Dashboard, cambia el periodo y revisa el tiempo contra SLA.
   - En Bandeja general, reasigna un ticket.
   - Recorre las cuatro pestañas de Rendimiento del modelo.
   - En Gestión de usuarios, crea un técnico con contraseña temporal y entra con él para ver el cambio de contraseña.
3. **Auditor (`auditor`):**
   - En Monitoreo, revisa el estado de PostgreSQL y abre una tabla.
   - Corre `uv run python -m app.cli backup` y míralo en Respaldos.
   - Pulsa "Verificar integridad".
   - En la Bitácora, filtra las ediciones posteriores al cierre y abre el historial de `TCK-115796`.

## Requisitos y pruebas

Cómo se cumple cada punto de la etapa 3 de `docs/ProyectoIA_Requrimientos.pdf`. Las etapas 1 y 2 (problemática, objetivos, diseño y justificación) están en `docs/Proyecto IA.docx`.

| Requisito | Dónde se cumple | Qué lo prueba |
| --- | --- | --- |
| 1. Recibir información del usuario, archivos u otra fuente | Registrar ticket (área, persona y descripción) y el dataset de 102,000 registros para entrenar | `front/e2e/register.spec.ts`, `back/tests/test_register.py`, `back/tests/test_ml.py` |
| 2. Procesarla con una técnica de IA identificable | Random Forest con TF-IDF para la prioridad; PNL para dispositivos, códigos de error, palabras clave, intención y sentimiento (`back/app/ml/`) | `back/tests/test_classify.py`, `back/tests/test_pnl.py` |
| 3. Generar una predicción o clasificación | Prioridad, departamento sugerido y sentimiento de cada ticket nuevo | `front/e2e/register.spec.ts`, `back/tests/test_classify.py` |
| 4. Presentar resultados comprensibles | Resultado del registro con "¿Por qué esta prioridad?", Dashboard y Rendimiento del modelo | `front/e2e/dashboard.spec.ts`, `front/e2e/model.spec.ts` |
| 5. Ejecutar distintos casos de prueba | "Cargar descripción de ejemplo" al registrar, las cuatro cuentas demo y las suites automáticas | Las 314 pruebas del back, 506 del front y 120 E2E |
| 6. Manejar entradas erróneas o imprevistas | Validaciones con mensajes en español, modelo ausente (503), sin conexión, ID de ticket mal escrito, sesión vencida e intentos de login repetidos | `front/e2e/register.spec.ts`, `front/e2e/access.spec.ts`, `front/e2e/audit.spec.ts`, `back/tests/test_errors.py`, `back/tests/test_security.py` |
