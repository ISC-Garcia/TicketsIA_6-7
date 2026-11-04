import type { Browser, Page } from '@playwright/test'

import { expect, test } from './fixtures'

async function signedIn(browser: Browser, username: string, password = 'demo2026') {
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 } })
  ).newPage()
  await signIn(page, username, password)
  await expect(page).not.toHaveURL(/\/login$/)
  return page
}

async function signIn(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(username)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
}

const userRow = (page: Page, username: string) =>
  page.getByRole('row').filter({ hasText: username })

test.describe('E5-04: gestión de usuarios', () => {
  test('crear un técnico, su primer acceso, reasignarle trabajo y desactivarlo', async ({
    browser,
  }) => {
    // 1. El coordinador crea a la técnica con una contraseña temporal.
    const coordinator = await signedIn(browser, 'coordinador')
    await coordinator.getByRole('link', { name: 'Gestión de usuarios' }).click()
    await expect(coordinator.getByText('4 usuarios activos de 4')).toBeVisible()
    await expect(userRow(coordinator, 'coordinador')).toContainText('Sesión actual')

    await coordinator.getByRole('button', { name: 'Nuevo usuario' }).click()
    const panel = coordinator.getByRole('dialog', { name: 'Nuevo usuario' })
    await panel.getByLabel('Nombre completo').fill('Ana López Ruiz')
    await panel.getByLabel('Usuario').fill('alopez')
    await panel.getByLabel('Contraseña temporal').fill('temporal1')
    await panel.getByRole('button', { name: 'Crear usuario' }).click()
    await expect(
      coordinator.getByRole('status').filter({ hasText: 'Usuario creado' }),
    ).toContainText('Ana López Ruiz, Técnico de TI')
    await expect(coordinator.getByText('5 usuarios activos de 5')).toBeVisible()

    // 2. Ana entra con la temporal y el sistema la obliga a cambiarla.
    const ana = await (
      await browser.newContext({ viewport: { width: 1440, height: 900 } })
    ).newPage()
    await signIn(ana, 'alopez', 'temporal1')
    await expect(ana).toHaveURL(/\/cambiar-contrasena$/)
    await ana.goto('/bandeja')
    await expect(ana).toHaveURL(/\/cambiar-contrasena$/)
    await ana.getByLabel('Contraseña temporal').fill('temporal1')
    await ana.getByLabel('Contraseña nueva', { exact: true }).fill('clave-de-ana-1')
    await ana.getByLabel('Confirma la contraseña nueva').fill('clave-de-ana-1')
    await ana.getByRole('button', { name: 'Guardar y continuar' }).click()
    await expect(ana).toHaveURL(/\/bandeja$/)

    // 3. El coordinador le reasigna un ticket: Ana aparece entre los técnicos activos.
    await coordinator.getByRole('link', { name: 'Bandeja general', exact: true }).click()
    await coordinator.getByRole('button', { name: 'Acciones de TCK-200003' }).click()
    await coordinator.getByRole('menuitem', { name: 'Reasignar' }).click()
    const modal = coordinator.getByRole('dialog', { name: 'Reasignar técnico' })
    await modal.getByRole('radio', { name: /Ana López Ruiz/ }).click()
    await modal.getByRole('button', { name: 'Reasignar' }).click()
    await expect(
      coordinator.getByRole('status').filter({ hasText: 'Técnico reasignado' }),
    ).toBeVisible()

    // 4. La desactiva: pierde la sesión y ya no puede entrar.
    await coordinator.getByRole('link', { name: 'Gestión de usuarios' }).click()
    await userRow(coordinator, 'alopez').getByRole('button', { name: 'Desactivar' }).click()
    await coordinator
      .getByRole('dialog', { name: '¿Desactivar a Ana López Ruiz?' })
      .getByRole('button', { name: 'Desactivar' })
      .click()
    await expect(userRow(coordinator, 'alopez')).toContainText('Inactivo')

    await ana.reload()
    await expect(ana).toHaveURL(/\/login$/)
    await signIn(ana, 'alopez', 'clave-de-ana-1')
    await expect(ana.getByRole('alert')).toHaveText('Usuario o contraseña incorrectos.')

    // 5. Su ticket conserva la asignación y ella ya no aparece para reasignar (P-6).
    await coordinator.getByRole('link', { name: 'Bandeja general', exact: true }).click()
    await expect(coordinator.getByRole('row').filter({ hasText: 'TCK-200003' })).toContainText(
      'Ana López',
    )
    await coordinator.getByRole('button', { name: 'Acciones de TCK-200007' }).click()
    await coordinator.getByRole('menuitem', { name: 'Reasignar' }).click()
    await expect(
      coordinator.getByRole('dialog', { name: 'Reasignar técnico' }).getByRole('radio'),
    ).toHaveCount(2)
  })

  test('las validaciones del nuevo usuario', async ({ browser }) => {
    const coordinator = await signedIn(browser, 'coordinador')
    await coordinator.goto('/usuarios')
    await coordinator.getByRole('button', { name: 'Nuevo usuario' }).click()
    const panel = coordinator.getByRole('dialog', { name: 'Nuevo usuario' })

    await panel.getByLabel('Usuario').fill('sxala')
    await panel.getByRole('button', { name: 'Crear usuario' }).click()

    await expect(panel.getByRole('alert')).toHaveText([
      'Escribe el nombre completo.',
      'Ese usuario ya existe.',
      'La contraseña debe tener al menos 8 caracteres.',
    ])
  })
})
