import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'

const OPEN_IN_ORDER = [
  'TCK-200007',
  'TCK-200003',
  'TCK-200014',
  'TCK-200011',
  'TCK-200021',
  'TCK-200018',
  'TCK-200029',
  'TCK-200025',
]

const rows = (page: Page) => page.locator('[role="rowgroup"]:last-child [role="row"] a')

async function signInAsTechnician(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill('tecnico')
  await page.getByLabel('Contraseña', { exact: true }).fill('demo2026')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/bandeja$/)
}

test.describe('E2-04: bandeja y detalle', () => {
  test.beforeEach(async ({ page }) => signInAsTechnician(page))

  test('la bandeja lista los abiertos por urgencia con sus conteos', async ({ page }) => {
    await expect(rows(page)).toHaveText(OPEN_IN_ORDER)
    await expect(page.getByText('8 tickets')).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Crítica, 2 tickets' })).toBeVisible()
  })

  test('los filtros se combinan, viven en la URL y se limpian', async ({ page }) => {
    await page.getByRole('radio', { name: 'Crítica, 2 tickets' }).click()
    await expect(page).toHaveURL(/prioridad=Cr%C3%ADtica/)
    await expect(rows(page)).toHaveText(['TCK-200007', 'TCK-200003'])

    await page.getByRole('searchbox', { name: 'Buscar por ID o texto' }).fill('dead')
    await expect(rows(page)).toHaveText(['TCK-200007'])
    await expect(page).toHaveURL(/q=dead/)

    await page.getByLabel('Estado').selectOption('Abierto')
    await expect(page.getByText('No hay tickets que coincidan con los filtros')).toBeVisible()

    await page.getByRole('button', { name: 'Limpiar filtros' }).first().click()
    await expect(page).toHaveURL(/\/bandeja$/)
    await expect(rows(page)).toHaveText(OPEN_IN_ORDER)
    await expect(page.getByRole('searchbox', { name: 'Buscar por ID o texto' })).toHaveValue('')
  })

  test('los resueltos solo aparecen al pedirlos', async ({ page }) => {
    await page.getByLabel('Estado').selectOption('Resuelto')

    await expect(rows(page)).toHaveText(['TCK-115796'])
    await expect(page.getByRole('radio', { name: 'Alta, 1 ticket' })).toBeVisible()
  })

  test('abre un ticket con el teclado, recorre sus pestañas y vuelve con los filtros', async ({
    page,
  }) => {
    await page.getByLabel('Departamento').selectOption('Seguridad Informática')
    await expect(rows(page)).toHaveText(['TCK-200007', 'TCK-200011'])

    await rows(page).first().focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/bandeja\/TCK-200007$/)
    await expect(page.getByRole('heading', { name: 'TCK-200007' })).toBeVisible()
    await expect(page.getByText('Vence en 50 min')).toBeVisible()

    await page.getByRole('tab', { name: 'Análisis IA' }).click()
    await expect(page.getByText('88 % de confianza')).toBeVisible()
    await page.getByRole('tab', { name: 'Historial' }).click()
    await expect(page.getByText('Clasificado por IA')).toBeVisible()

    await page
      .getByRole('navigation', { name: 'Ruta' })
      .getByRole('link', { name: 'Bandeja de incidentes' })
      .click()
    await expect(page).toHaveURL(/departamento=Seguridad/)
    await expect(rows(page)).toHaveText(['TCK-200007', 'TCK-200011'])
  })

  test('un ticket inexistente avisa y vuelve a la bandeja', async ({ page }) => {
    await page.goto('/bandeja/TCK-000000')

    await expect(page.getByText('No se encontró el ticket TCK-000000')).toBeVisible()
    await page.getByRole('button', { name: 'Volver a la bandeja' }).click()
    await expect(page).toHaveURL(/\/bandeja$/)
  })

  test('si la API no responde muestra el error y permite reintentar', async ({ page }) => {
    await page.route('**/api/tickets**', (route) => route.abort())
    await page.reload()

    await expect(page.getByText('No se pudo conectar con el servidor.')).toBeVisible()

    await page.unroute('**/api/tickets**')
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(rows(page)).toHaveText(OPEN_IN_ORDER)
  })
})
