import type { APIRequestContext, Page } from '@playwright/test'

import { API_URL } from '../playwright.config'
import { expect, test } from './fixtures'

async function signInAsCoordinator(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill('coordinador')
  await page.getByLabel('Contraseña', { exact: true }).fill('demo2026')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

// Resuelve un ticket directo en la API, como si el técnico lo hubiera hecho en otra pantalla.
async function resolveAsTechnician(request: APIRequestContext, ticketId: string) {
  const login = await request.post(`${API_URL}/api/auth/login`, {
    data: { username: 'tecnico', password: 'demo2026' },
  })
  const { token } = await login.json()
  const response = await request.post(`${API_URL}/api/tickets/${ticketId}/resolve`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { solution: 'Se reinició el nodo y se liberó el bloqueo.', resolutionHours: 3 },
  })
  expect(response.ok()).toBe(true)
}

const kpi = (page: Page, label: string) =>
  page.locator('.dashboard__kpi').filter({ hasText: label }).locator('.dashboard__kpi-value')

test.describe('E6-03: dashboard', () => {
  test('los KPI coinciden con la bandeja general', async ({ page }) => {
    await signInAsCoordinator(page)

    await expect(kpi(page, 'Tickets abiertos')).toHaveText('8')
    await expect(kpi(page, 'Críticos pendientes')).toHaveText('2')

    await page.getByRole('link', { name: 'Ver bandeja general' }).click()
    await expect(page).toHaveURL(/\/general$/)
    await expect(page.getByText('8 tickets')).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Crítica, 2 tickets' })).toBeVisible()
  })

  test('cambiar el periodo actualiza la tendencia y la URL', async ({ page }) => {
    await signInAsCoordinator(page)
    const labels = page.locator('.trend__label')

    await expect(page.getByText('Último mes, por semana')).toBeVisible()
    await expect(labels).toHaveCount(5)

    await page.getByRole('radio', { name: 'Última semana' }).click()
    await expect(page).toHaveURL(/periodo=semana/)
    await expect(labels).toHaveText([
      'Jue 22',
      'Vie 23',
      'Sáb 24',
      'Dom 25',
      'Lun 26',
      'Mar 27',
      'Mié 28',
    ])
    await expect(page.getByText('Creados 4')).toBeVisible()

    await page.getByRole('radio', { name: 'Último año' }).click()
    await expect(labels).toHaveCount(12)

    await page.reload()
    await expect(page.getByRole('radio', { name: 'Último año' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  test('resolver un crítico lo quita de la tabla de críticos', async ({ page, request }) => {
    await signInAsCoordinator(page)
    const critical = page.locator('.dashboard__id')
    await expect(critical).toHaveText(['TCK-200007', 'TCK-200003'])

    await resolveAsTechnician(request, 'TCK-200007')
    await page.reload()

    await expect(critical).toHaveText(['TCK-200003'])
    await expect(kpi(page, 'Críticos pendientes')).toHaveText('1')
    await expect(kpi(page, 'Tickets abiertos')).toHaveText('7')
    await expect(page.locator('.trend__end--resolved')).toHaveText('Resueltos 1')
  })

  test('un crítico de la tabla abre su detalle de solo lectura', async ({ page }) => {
    await signInAsCoordinator(page)

    await page.locator('.dashboard__id').first().click()

    await expect(page).toHaveURL(/\/general\/TCK-200007$/)
    await expect(page.getByText('Solo lectura')).toBeVisible()
  })
})
