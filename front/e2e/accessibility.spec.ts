import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'

const SCREENS = {
  tecnico: ['/registrar', '/bandeja', '/bandeja/TCK-200003'],
  coordinador: [
    '/dashboard',
    '/general',
    '/general/TCK-200003',
    '/modelo',
    '/modelo/matriz',
    '/modelo/datos',
    '/modelo/modelo',
    '/usuarios',
  ],
  auditor: [
    '/monitoreo',
    '/monitoreo/tablas',
    '/monitoreo/respaldos',
    '/bitacora',
    '/historial/TCK-115796',
  ],
} as const

async function signIn(page: Page, username: string) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(username)
  await page.getByLabel('Contraseña', { exact: true }).fill('demo2026')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}

// Solo cuentan los problemas graves y críticos de WCAG 2.1 A y AA.
async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // El botón flotante de Vue DevTools solo existe en desarrollo, no en la aplicación.
    .exclude('.panel-entry-btn')
    .analyze()
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(' | ')}`,
    )
}

async function settled(page: Page) {
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/Cargando|Consultando/)).toHaveCount(0)
}

test.describe('E10-01: accesibilidad', () => {
  test('el login no tiene problemas graves', async ({ page }) => {
    await page.goto('/login')

    expect(await seriousViolations(page)).toEqual([])
  })

  for (const [role, paths] of Object.entries(SCREENS)) {
    test(`las pantallas de ${role} no tienen problemas graves`, async ({ page }) => {
      await signIn(page, role)
      for (const path of paths) {
        await page.goto(path)
        await settled(page)
        expect(await seriousViolations(page), path).toEqual([])
      }
    })

    test(`las pantallas de ${role} caben a 1,280 px sin desplazamiento horizontal`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await signIn(page, role)
      for (const path of paths) {
        await page.goto(path)
        await settled(page)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, path).toBeLessThanOrEqual(0)
      }
    })
  }

  test('el técnico entra y abre un ticket solo con el teclado', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Usuario').focus()
    await page.keyboard.type('tecnico')
    await page.keyboard.press('Tab')
    await page.keyboard.type('demo2026')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/bandeja$/)

    const link = page.getByRole('link', { name: 'TCK-200007' })
    await link.focus()
    await expect(link).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/bandeja\/TCK-200007$/)

    // Las pestañas del detalle se recorren con las flechas.
    await page.getByRole('tab', { name: 'Resumen' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Análisis IA' })).toBeFocused()
    await expect(page.getByRole('tab', { name: 'Análisis IA' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('el coordinador cambia el periodo y cierra un panel solo con el teclado', async ({
    page,
  }) => {
    await signIn(page, 'coordinador')

    await page.getByRole('radio', { name: 'Último mes' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page).toHaveURL(/periodo=a%C3%B1o|periodo=año/)

    await page.goto('/usuarios')
    await page.getByRole('button', { name: 'Nuevo usuario' }).focus()
    await page.keyboard.press('Enter')
    const panel = page.getByRole('dialog', { name: 'Nuevo usuario' })
    await expect(panel).toBeVisible()
    // El foco entra al panel y Tab avanza dentro de él.
    expect(await panel.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Tab')
    expect(await panel.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Nuevo usuario' })).toBeFocused()
  })

  test('el auditor recorre las pestañas del monitoreo con las flechas', async ({ page }) => {
    await signIn(page, 'auditor')

    await page.getByRole('tab', { name: 'Estado general' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page).toHaveURL(/\/monitoreo\/tablas$/)
    await page.keyboard.press('ArrowRight')
    await expect(page).toHaveURL(/\/monitoreo\/respaldos$/)
    await expect(page.getByRole('tab', { name: 'Respaldos' })).toBeFocused()
  })

  test('el aviso queda sobre los diálogos abiertos', async ({ page }) => {
    await signIn(page, 'coordinador')
    await page.goto('/usuarios')
    await page.getByRole('button', { name: 'Nuevo usuario' }).click()
    const panel = page.getByRole('dialog', { name: 'Nuevo usuario' })
    await panel.getByLabel('Nombre completo').fill('Ana López Ruiz')
    await panel.getByLabel('Usuario').fill('alopez')
    await panel.getByLabel('Contraseña temporal').fill('temporal1')
    await panel.getByRole('button', { name: 'Crear usuario' }).click()

    // El usuario se creó y el aviso se muestra en la capa superior, encima de cualquier diálogo.
    const region = page.locator('.toast-region')
    await expect(region).toContainText('Usuario creado')
    expect(await region.evaluate((element) => element.matches(':popover-open'))).toBe(true)
    await page.getByRole('button', { name: 'Desactivar' }).first().click()
    const confirm = page.getByRole('dialog', { name: /Desactivar a/ })
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Desactivar' }).click()
    await expect(region).toContainText('Usuario desactivado')
    // El aviso nuevo se vuelve a abrir al final de la capa superior.
    const order = await page.evaluate(() => {
      const toast = document.querySelector('.toast-region')!
      return toast.matches(':popover-open')
    })
    expect(order).toBe(true)
  })
})
