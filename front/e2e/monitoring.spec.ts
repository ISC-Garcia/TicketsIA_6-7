import type { Page } from '@playwright/test'

import { API_URL } from '../playwright.config'
import { expect, test } from './fixtures'

async function signInAsAuditor(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill('auditor')
  await page.getByLabel('Contraseña', { exact: true }).fill('demo2026')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/monitoreo$/)
}

test.describe('E9-06: monitoreo', () => {
  test('recorre las tres pestañas y los tres periodos, y abre una tabla', async ({ page }) => {
    await signInAsAuditor(page)

    // Estado general: los indicadores salen del PostgreSQL de pruebas.
    await expect(page.locator('.monitor__indicator').first()).toContainText('En línea')
    await expect(page.locator('.monitor__indicator')).toHaveCount(8)
    for (const [label, query] of [
      ['Última semana', '?periodo=semana'],
      ['Último mes', '?periodo=mes'],
      ['Últimas 24 horas', ''],
    ] as const) {
      await page.getByRole('radio', { name: label }).click()
      await expect(page).toHaveURL(new RegExp(`/monitoreo${query.replace('?', '\\?')}$`))
      await expect(page.getByRole('heading', { name: 'Consultas por hora' })).toBeVisible()
    }

    await page.getByRole('tab', { name: 'Tablas' }).click()
    await expect(page).toHaveURL(/\/monitoreo\/tablas$/)
    await expect(page.getByRole('navigation', { name: 'Ruta' })).toContainText('Tablas')
    const tickets = page.getByRole('row').filter({ hasText: 'tickets' }).first()
    await expect(tickets).toContainText('9')
    await page.getByRole('button', { name: 'tickets', exact: true }).click()
    const panel = page.getByRole('dialog', { name: 'tickets' })
    await expect(panel).toContainText('Cada ticket de soporte')
    await expect(panel.getByRole('row').filter({ hasText: 'content_sha256' })).toBeVisible()
    await panel.getByText('Cerrar', { exact: true }).click()

    await page.getByRole('tab', { name: 'Respaldos' }).click()
    await expect(page).toHaveURL(/\/monitoreo\/respaldos$/)
    await expect(page.getByRole('heading', { name: 'Respaldos' })).toBeVisible()
  })

  test('un respaldo ejecutado aparece en la lista y en el estado general', async ({
    page,
    request,
  }) => {
    expect((await request.post(`${API_URL}/api/test/backup`)).status()).toBe(204)
    await signInAsAuditor(page)

    // Con o sin éxito (el pg_dump del equipo puede ser de otra versión), queda registrado.
    await expect(page.locator('.monitor__indicator').last()).toContainText(/Exitoso|Fallido/)
    await page.getByRole('tab', { name: 'Respaldos' }).click()
    const newest = page.locator('.backups tbody tr').first()
    await expect(newest).toContainText(/Exitoso|Fallido/)
    await expect(newest).toContainText(/SHA-256|pg_dump|ejecutar/)
  })

  test('la verificación señala un ticket modificado por fuera del sistema', async ({
    page,
    request,
  }) => {
    await signInAsAuditor(page)
    await page.goto('/monitoreo/tablas')

    await page.getByRole('button', { name: 'Verificar integridad' }).click()
    const items = page.locator('.integrity__item')
    // Los respaldos también se llaman "tickets-…": se busca la tabla por su nombre exacto.
    const table = (name: string) =>
      items.filter({ has: page.locator('.integrity__name', { hasText: new RegExp(`^${name}$`) }) })
    await expect(table('tickets')).toContainText('Sin cambios')
    await expect(page.getByText('No detecta registros borrados.')).toBeVisible()

    expect((await request.post(`${API_URL}/api/test/tamper/TCK-115796`)).status()).toBe(204)
    await page.getByRole('button', { name: 'Verificar integridad' }).click()

    const tickets = table('tickets')
    await expect(tickets).toContainText('1 alterado')
    await expect(tickets.locator('.integrity__examples')).toHaveText('TCK-115796')
    await expect(table('events')).toContainText('Sin cambios')
  })
})
