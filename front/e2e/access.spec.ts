import type { Page } from '@playwright/test'

import { API_URL } from '../playwright.config'
import { expect, test } from './fixtures'

const PASSWORD = 'demo2026'

async function signIn(page: Page, username: string, password = PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(username)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
}

test.describe('E1-04: acceso', () => {
  for (const [username, path, section] of [
    ['tecnico', '/bandeja', 'Mesa de servicio'],
    ['coordinador', '/dashboard', 'Coordinación'],
    ['auditor', '/monitoreo', 'Auditoría'],
  ] as const) {
    test(`${username} entra y llega a su inicio`, async ({ page }) => {
      await signIn(page, username)

      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByRole('navigation', { name: section })).toBeVisible()
    })
  }

  test('los accesos de demostración llenan el formulario', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /Coordinador/ }).click()
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('una contraseña incorrecta muestra el error', async ({ page }) => {
    await signIn(page, 'tecnico', 'incorrecta')

    await expect(page.getByRole('alert')).toHaveText('Usuario o contraseña incorrectos.')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('un usuario desactivado recibe el mismo error', async ({ page, request }) => {
    await request.patch(`${API_URL}/api/test/users/sxala`, { data: { active: false } })

    await signIn(page, 'sxala')

    await expect(page.getByRole('alert')).toHaveText('Usuario o contraseña incorrectos.')
  })

  test('sin sesión, una ruta protegida lleva al login', async ({ page }) => {
    await page.goto('/bandeja')

    await expect(page).toHaveURL(/\/login$/)
  })

  test('la ruta de otro rol lleva al inicio propio', async ({ page }) => {
    await signIn(page, 'tecnico')
    await expect(page).toHaveURL(/\/bandeja$/)

    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/bandeja$/)
  })

  test('salir pide confirmación y Atrás ya no recupera la sesión', async ({ page }) => {
    await signIn(page, 'auditor')
    await expect(page).toHaveURL(/\/monitoreo$/)

    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    const dialog = page.getByRole('dialog', { name: '¿Deseas cerrar sesión?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cerrar sesión' }).click()

    await expect(page).toHaveURL(/\/login$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('navigation', { name: 'Auditoría' })).toHaveCount(0)
  })

  test('cancelar la confirmación conserva la sesión', async ({ page }) => {
    await signIn(page, 'auditor')
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()

    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()

    await expect(page).toHaveURL(/\/monitoreo$/)
  })

  test('si desactivan la cuenta, al recargar vuelve al login con un aviso', async ({
    page,
    request,
  }) => {
    await signIn(page, 'sxala')
    await expect(page).toHaveURL(/\/bandeja$/)

    await request.patch(`${API_URL}/api/test/users/sxala`, { data: { active: false } })
    await page.reload()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('status').filter({ hasText: 'Tu sesión terminó' })).toHaveText(
      'Tu sesión terminó. Vuelve a iniciar sesión.',
    )
  })
})
