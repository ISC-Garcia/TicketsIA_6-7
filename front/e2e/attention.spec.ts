import type { Browser, Page } from '@playwright/test'

import { expect, test } from './fixtures'

const DESCRIPTION =
  'El Servidor Ubuntu se encuentra completamente fuera de servicio por KERNEL_PANIC. Todo el personal está paralizado sin poder acceder a los sistemas core.'

// Cada rol trabaja en su propio contexto, como dos personas en navegadores distintos.
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

const rows = (page: Page) => page.locator('[role="rowgroup"]:last-child [role="row"] a')

test.describe('E4-06: ciclo completo de un ticket', () => {
  test('registrar, reasignar, atender, resolver y revisar la historia', async ({ browser }) => {
    // 1. Roberto registra el ticket: queda asignado a él.
    const roberto = await signedIn(browser, 'tecnico')
    await roberto.getByRole('link', { name: 'Registrar ticket' }).click()
    await roberto.getByLabel('Área solicitante').selectOption('Operaciones')
    await roberto.getByLabel('Nombre de quien reporta').fill('Jorge Méndez Castillo')
    await roberto.getByLabel('Descripción del problema').fill(DESCRIPTION)
    await roberto.getByRole('button', { name: 'Analizar y registrar' }).click()
    await roberto.getByRole('button', { name: 'Confirmar registro' }).click()
    await expect(roberto).toHaveURL(/\/bandeja\/TCK-200030$/)
    await expect(roberto.getByRole('button', { name: 'Atender' })).toBeVisible()

    // 2. El coordinador lo reasigna a Sarely desde la bandeja general.
    const coordinator = await signedIn(browser, 'coordinador')
    await coordinator.getByRole('link', { name: 'Bandeja general', exact: true }).click()
    await coordinator.getByRole('button', { name: 'Acciones de TCK-200030' }).click()
    await coordinator.getByRole('menuitem', { name: 'Reasignar' }).click()
    const modal = coordinator.getByRole('dialog', { name: 'Reasignar técnico' })
    await expect(modal.getByRole('radio', { name: /Roberto García Hernández/ })).toContainText(
      'Actual',
    )
    await modal.getByRole('radio', { name: /Sarely Xala Hernández/ }).click()
    await modal.getByRole('button', { name: 'Reasignar' }).click()
    await expect(
      coordinator.getByRole('status').filter({ hasText: 'Técnico reasignado' }),
    ).toContainText('TCK-200030, ahora con Sarely Xala Hernández')
    await expect(coordinator).toHaveURL(/\/general$/)

    // 3. Roberto ya no puede atenderlo.
    await roberto.reload()
    await expect(roberto.getByRole('button', { name: 'Atender' })).toHaveCount(0)
    await expect(roberto.getByText('Asignado a Sarely Xala Hernández')).toBeVisible()

    // 4. Sarely lo atiende y lo resuelve.
    const sarely = await signedIn(browser, 'sxala')
    await sarely.goto('/bandeja/TCK-200030')
    await sarely.getByRole('button', { name: 'Atender' }).click()
    await expect(sarely.locator('.status').first()).toHaveText('En atención')
    await sarely.getByRole('button', { name: 'Marcar como resuelto' }).click()
    const panel = sarely.getByRole('dialog', { name: 'Marcar como resuelto' })
    await panel
      .getByLabel('Solución aplicada')
      .fill('Se reinició el servidor y se aplicó el parche.')
    await panel.getByLabel('Tiempo de resolución').fill('1.5')
    await panel.getByRole('button', { name: 'Confirmar resolución' }).click()
    await sarely
      .getByRole('dialog', { name: '¿Confirmar la resolución de TCK-200030?' })
      .getByRole('button', { name: 'Confirmar resolución' })
      .click()
    await expect(
      sarely.getByText('Ticket TCK-200030 resuelto en 1.50 h por Sarely Xala Hernández'),
    ).toBeVisible()
    await sarely.getByRole('button', { name: 'Ver historial del ticket' }).click()

    // 5. La historia completa queda en el detalle.
    await expect(sarely.locator('.timeline__type')).toHaveText([
      'Ticket creado',
      'Clasificado por IA',
      'Reasignación',
      'Cambio de estado',
      'Ticket resuelto',
    ])
    await expect(sarely.getByText('Roberto García Hernández a Sarely Xala Hernández')).toBeVisible()
    await expect(sarely.locator('.detail__sla-label')).toHaveText('Resuelto en 1.50 h')

    // 6. Ya no aparece en la bandeja normal, sí entre los resueltos.
    await sarely.getByRole('navigation', { name: 'Ruta' }).getByRole('link').click()
    await expect(rows(sarely)).not.toContainText(['TCK-200030'])
    await sarely.getByLabel('Estado').selectOption('Resuelto')
    await expect(rows(sarely)).toContainText(['TCK-200030'])
    await coordinator.reload()
    await expect(coordinator.getByRole('button', { name: 'Acciones de TCK-200030' })).toHaveCount(0)
  })

  test('el coordinador consulta el detalle en solo lectura', async ({ browser }) => {
    const coordinator = await signedIn(browser, 'coordinador')
    await coordinator.goto('/general')
    await rows(coordinator).first().click()

    await expect(coordinator).toHaveURL(/\/general\/TCK-200007$/)
    await expect(coordinator.getByText('Solo lectura')).toBeVisible()
    await expect(coordinator.getByRole('button', { name: 'Marcar como resuelto' })).toHaveCount(0)
    await coordinator.getByRole('navigation', { name: 'Ruta' }).getByRole('link').click()
    await expect(coordinator).toHaveURL(/\/general$/)
  })

  test('el menú de acciones se usa con el teclado', async ({ browser }) => {
    const coordinator = await signedIn(browser, 'coordinador')
    await coordinator.goto('/general')
    const trigger = coordinator.getByRole('button', { name: 'Acciones de TCK-200007' })

    await trigger.focus()
    await coordinator.keyboard.press('Enter')
    await expect(coordinator.getByRole('menuitem', { name: 'Reasignar' })).toBeFocused()
    await coordinator.keyboard.press('Escape')
    await expect(coordinator.getByRole('menu')).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('E4-07: quien resolvió corrige las horas y queda en el historial', async ({ browser }) => {
    const sarely = await signedIn(browser, 'sxala')
    await sarely.goto('/bandeja/TCK-115796')

    await sarely.getByRole('button', { name: 'Corregir resolución' }).click()
    const panel = sarely.getByRole('dialog', { name: 'Corregir resolución' })
    await panel.getByLabel('Tiempo de resolución').fill('3.5')
    await panel.getByRole('button', { name: 'Guardar corrección' }).click()
    await sarely
      .getByRole('dialog', { name: '¿Guardar la corrección de TCK-115796?' })
      .getByRole('button', { name: 'Guardar corrección' })
      .click()

    await expect(sarely.getByText('Resolución de TCK-115796 corregida: 3.50 h')).toBeVisible()
    await sarely.getByRole('button', { name: 'Ver historial del ticket' }).click()
    const lastEdit = sarely.locator('.timeline__event').last()
    await expect(lastEdit).toContainText('Edición posterior al cierre')
    await expect(lastEdit).toContainText('2.00 h')
    await expect(lastEdit).toContainText('3.50 h')
    await expect(lastEdit).toContainText('Sarely Xala Hernández')

    const roberto = await signedIn(browser, 'tecnico')
    await roberto.goto('/bandeja/TCK-115796')
    await expect(roberto.getByRole('heading', { name: 'TCK-115796' })).toBeVisible()
    await expect(roberto.getByRole('button', { name: 'Corregir resolución' })).toHaveCount(0)
  })
})
