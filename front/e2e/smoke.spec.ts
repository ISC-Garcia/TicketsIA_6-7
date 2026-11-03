import { API_URL } from '../playwright.config'
import { expect, test } from './fixtures'

test('E0-07: el front carga el login', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole('heading', { name: 'Sistema de Tickets de Soporte Técnico' }),
  ).toBeVisible()
})

test('E0-07: el front llega a la API real a través de /api', async ({ page, request }) => {
  await page.goto('/login')

  const health = await page.request.get('/api/health')
  const direct = await request.get(`${API_URL}/api/health`)

  expect(health.ok()).toBe(true)
  expect(await health.json()).toMatchObject({ status: 'ok', database: true })
  expect(await direct.json()).toMatchObject({ now: '2026-10-28T11:42:10-06:00' })
})
