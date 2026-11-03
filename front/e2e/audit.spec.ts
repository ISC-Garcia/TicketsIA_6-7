import type { Browser, Page } from '@playwright/test'

import { expect, test } from './fixtures'

async function signedIn(browser: Browser, username: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(username)
  await page.getByLabel('Contraseña', { exact: true }).fill('demo2026')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).not.toHaveURL(/\/login$/)
  return page
}

const afterCloseToggle = (page: Page) =>
  page.getByRole('button', { name: /Solo ediciones posteriores al cierre/ })

test.describe('E8-04: auditoría', () => {
  test('rastrear TCK-115796 desde la bitácora hasta su historial', async ({ browser }) => {
    const auditor = await signedIn(browser, 'auditor')
    await auditor.getByRole('link', { name: 'Bitácora de registros' }).click()

    await expect(afterCloseToggle(auditor)).toContainText('1')
    await afterCloseToggle(auditor).click()
    await expect(auditor).toHaveURL(/posteriores=1/)
    await expect(auditor.getByText('1 evento')).toBeVisible()

    await auditor.getByRole('row').filter({ hasText: 'TCK-115796' }).click()
    const panel = auditor.getByRole('dialog', { name: 'Edición de datos' })
    await expect(panel).toContainText('El ticket se resolvió el 2025-12-09 04:12:45')
    await expect(panel).toContainText('10.25 h')
    await expect(panel).toContainText('2.00 h')
    await panel.getByRole('button', { name: 'Ver historial del ticket' }).click()

    await expect(auditor).toHaveURL(/\/historial\/TCK-115796$/)
    await expect(auditor.getByRole('navigation', { name: 'Ruta' })).toContainText(
      'Historial de ticket',
    )
    await expect(auditor.locator('.history__field').last()).toHaveText(
      /Tiempo de resolución\s*Edición posterior al cierre\s*2\.00 h/,
    )
    const lastEvent = auditor.locator('.timeline__event').last()
    await expect(lastEvent).toContainText('Edición posterior al cierre')
    await expect(lastEvent).toContainText('Francisco Alejandro Parra Huerta')

    // Volver a la bitácora conserva el filtro.
    await auditor.goBack()
    await expect(auditor).toHaveURL(/\/bitacora\?posteriores=1$/)
    await expect(afterCloseToggle(auditor)).toHaveAttribute('aria-pressed', 'true')
  })

  test('una corrección del técnico aparece en la bitácora y en el historial', async ({
    browser,
  }) => {
    // Sarely resolvió TCK-115796 y corrige sus horas (E4-07).
    const sarely = await signedIn(browser, 'sxala')
    await sarely.goto('/bandeja/TCK-115796')
    await sarely.getByRole('button', { name: 'Corregir resolución' }).click()
    const correction = sarely.getByRole('dialog', { name: 'Corregir resolución' })
    await correction.getByLabel('Tiempo de resolución').fill('3.5')
    await correction.getByRole('button', { name: 'Guardar corrección' }).click()
    await sarely
      .getByRole('dialog', { name: '¿Guardar la corrección de TCK-115796?' })
      .getByRole('button', { name: 'Guardar corrección' })
      .click()
    await expect(sarely.getByText('Resolución de TCK-115796 corregida: 3.50 h')).toBeVisible()

    const auditor = await signedIn(browser, 'auditor')
    await auditor.goto('/bitacora')
    await expect(afterCloseToggle(auditor)).toContainText('2')
    await auditor.getByLabel('Buscar por ID de ticket').fill('TCK-115796')
    await auditor.getByLabel('Buscar por ID de ticket').press('Enter')
    await auditor.getByLabel('Usuario').selectOption('Sarely Xala Hernández')
    await auditor.getByLabel('Tipo de evento').selectOption('Edición de datos')
    await expect(auditor.getByText('1 evento')).toBeVisible()

    const row = auditor.getByRole('row').filter({ hasText: 'TCK-115796' })
    await expect(row).toContainText('Edición posterior al cierre')
    await row.click()
    const panel = auditor.getByRole('dialog', { name: 'Edición de datos' })
    await expect(panel).toContainText('2.00 h')
    await expect(panel).toContainText('3.50 h')
    await panel.getByRole('button', { name: 'Ver historial del ticket' }).click()

    await expect(auditor).toHaveURL(/\/historial\/TCK-115796$/)
    await expect(auditor.locator('.history__field').last()).toContainText('3.50 h')
    const edits = auditor.locator('.timeline__event--after-close')
    await expect(edits).toHaveCount(2)
    await expect(edits.last()).toContainText('Sarely Xala Hernández')
  })

  test('el historial valida el ID y avisa si el ticket no existe', async ({ browser }) => {
    const auditor = await signedIn(browser, 'auditor')
    await auditor.getByRole('link', { name: 'Historial de ticket' }).click()

    await auditor.getByLabel('ID de ticket').fill('115796')
    await auditor.getByRole('button', { name: 'Consultar' }).click()
    await expect(auditor.getByRole('alert')).toHaveText('Escribe un ID con el formato TCK-000000.')

    await auditor.getByLabel('ID de ticket').fill('TCK-000001')
    await auditor.getByRole('button', { name: 'Consultar' }).click()
    await expect(auditor.getByText('No se encontró ningún ticket con ese ID')).toBeVisible()
    await expect(auditor).toHaveURL(/\/historial\/TCK-000001$/)
  })
})
