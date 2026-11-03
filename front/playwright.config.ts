import { defineConfig, devices } from '@playwright/test'

// Las pruebas E2E levantan la API real contra la base `tickets_e2e` y el front de desarrollo,
// que reenvía /api a esa API. Cada prueba recarga la semilla demo (ver e2e/fixtures.ts).

const API_PORT = 8100
const FRONT_PORT = 5180
export const API_URL = `http://localhost:${API_PORT}`

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://tickets:tickets@localhost:5432/tickets_e2e'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Todas las pruebas comparten una base: van una a la vez para no pisarse los datos.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${FRONT_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: `uv run alembic upgrade head && uv run fastapi run app/main.py --port ${API_PORT}`,
      cwd: '../back',
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        APP_ENV: 'test',
        DATABASE_URL,
        JWT_SECRET: 'clave-de-pruebas-e2e-no-usar-en-produccion',
        APP_NOW: '2026-10-28T11:42:10-06:00',
        TIMEZONE: 'America/Mexico_City',
      },
    },
    {
      command: `npm run dev -- --port ${FRONT_PORT} --strictPort`,
      url: `http://localhost:${FRONT_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        API_PROXY: API_URL,
        VITE_DEMO_MODE: 'true',
      },
    },
  ],
})
