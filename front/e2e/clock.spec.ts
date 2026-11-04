import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'

async function signInAsTechnician(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill('tecnico')
  await page.getByLabel('Contraseña', { exact: true }).fill('demo2026')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/bandeja$/)
}

// La API de pruebas fija su hora en 2026-10-28 11:42:10 (APP_NOW), mientras el navegador usa
// el reloj real del equipo. Lo que se ve debe salir de la hora del servidor.
test.describe('E11-04: reloj real', () => {
  test('la barra superior muestra el día del servidor, no el del equipo', async ({ page }) => {
    await signInAsTechnician(page)

    await expect(page.locator('.header__date')).toHaveText('Miércoles, 28 de octubre de 2026')
  })

  test('la antigüedad y el SLA se calculan con la hora del servidor', async ({ page }) => {
    await signInAsTechnician(page)

    // Registrado a las 09:57: a las 11:42 lleva 1 h 45 min y le quedan 2 h 15 min de su SLA de 4 h.
    const row = page.getByRole('row').filter({ hasText: 'TCK-200003' })
    await expect(row).toContainText('1 h 45 min')
    await expect(row).toContainText('2 h 15 min')
  })

  test('la fecha de registro de un ticket nuevo es la del servidor', async ({ page }) => {
    await signInAsTechnician(page)

    await page.getByRole('link', { name: 'Registrar ticket' }).click()

    await expect(page.locator('.register__date')).toHaveText('2026-10-28 11:42')
  })
})
