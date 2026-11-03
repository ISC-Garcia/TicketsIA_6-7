import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'

// Un caso por prioridad, con frases como las del dataset con que se entrena el modelo.
const CASES = [
  {
    priority: 'Crítica',
    device: 'Servidor Ubuntu',
    code: 'KERNEL_PANIC',
    text: 'El Servidor Ubuntu se encuentra completamente fuera de servicio por KERNEL_PANIC. Todo el personal está paralizado sin poder acceder a los sistemas core. Requerimos escalamiento inmediato a nivel directivo.',
  },
  {
    priority: 'Alta',
    device: 'Gateway VPN',
    code: 'TIMEOUT_504',
    text: 'Detectamos lentitud extrema y desconexiones esporádicas en el Gateway VPN marcando TIMEOUT_504. Un grupo importante de usuarios externos no puede completar sus transacciones. Solicitamos revisión prioritaria en el transcurso del turno.',
  },
  {
    priority: 'Media',
    device: 'Paquetería Office',
    code: null,
    text: 'Tengo problemas para utilizar la Paquetería Office en mi estación de trabajo. Esto retrasa ligeramente mi reporte individual de hoy. Quedo a la espera de que soporte local pueda conectarse a mi equipo.',
  },
  {
    priority: 'Baja',
    device: 'Mouse Óptico',
    code: null,
    text: 'Requiero un reemplazo o revisión física de mi Mouse Óptico por desgaste. Puedo seguir trabajando sin problemas, es solo para mejorar mi ergonomía. Agradezco su apoyo sin prisa alguna. Buen día.',
  },
] as const

async function openRegister(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill('tecnico')
  await page.getByLabel('Contraseña', { exact: true }).fill('demo2026')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/bandeja$/)
  await page.getByRole('link', { name: 'Registrar ticket' }).click()
  await expect(page.getByRole('heading', { name: 'Registrar ticket' })).toBeVisible()
}

async function capture(page: Page, text: string) {
  await page.getByLabel('Área solicitante').selectOption('Sistemas')
  await page.getByLabel('Nombre de quien reporta').fill('Ana López')
  await page.getByLabel('Descripción del problema').fill(text)
  await page.getByRole('button', { name: 'Analizar y registrar' }).click()
}

test.describe('E3-06: registro con clasificación', () => {
  test.beforeEach(async ({ page }) => openRegister(page))

  for (const item of CASES) {
    test(`clasifica y registra un ticket de prioridad ${item.priority}`, async ({ page }) => {
      await capture(page, item.text)

      const result = page.locator('.result')
      await expect(result.locator('.priority').first()).toHaveText(item.priority)
      await expect(result.getByText(`${item.device} (detectado)`)).toBeVisible()
      await expect(result.locator('mark').first()).toHaveText(item.device)
      await expect(result.getByText(`Códigos de error: ${item.code ?? 'ninguno'}`)).toBeVisible()

      await page.getByRole('button', { name: 'Confirmar registro' }).click()
      await expect(page).toHaveURL(/\/bandeja\/TCK-200030$/)
      await expect(page.getByRole('heading', { name: 'TCK-200030' })).toBeVisible()
      await expect(page.getByRole('status').filter({ hasText: 'Ticket registrado' })).toBeVisible()
      await page.getByRole('tab', { name: 'Análisis IA' }).click()
      await expect(page.locator('.analysis .priority')).toHaveText(item.priority)

      await page.getByRole('navigation', { name: 'Ruta' }).getByRole('link').click()
      await page.getByRole('searchbox', { name: 'Buscar por ID o texto' }).fill('TCK-200030')
      await expect(page.locator('[role="rowgroup"]:last-child [role="row"] a')).toHaveText([
        'TCK-200030',
      ])
    })
  }

  test('valida la captura antes de analizar', async ({ page }) => {
    await page.getByRole('button', { name: 'Analizar y registrar' }).click()

    await expect(page.getByRole('alert')).toHaveText([
      'Selecciona el área solicitante.',
      'Escribe el nombre de quien reporta.',
      'Describe el problema con al menos 20 caracteres.',
    ])
  })

  test('editar vuelve a la captura y se vuelve a analizar', async ({ page }) => {
    await capture(page, CASES[3].text)
    await expect(page.locator('.result .priority').first()).toHaveText('Baja')

    await page.getByRole('button', { name: 'Editar descripción' }).click()
    await page.getByLabel('Descripción del problema').fill(CASES[0].text)
    await page.getByRole('button', { name: 'Analizar y registrar' }).click()

    await expect(page.locator('.result .priority').first()).toHaveText('Crítica')
  })

  test('explica por qué eligió la prioridad', async ({ page }) => {
    await capture(page, CASES[0].text)
    await page.getByRole('button', { name: '¿Por qué esta prioridad?' }).click()

    const panel = page.getByRole('dialog', { name: '¿Por qué esta prioridad?' })
    await expect(panel).toContainText('Sistemas')
    await expect(panel).toContainText('(inferido)')
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
  })

  test('si el modelo no está disponible lo avisa', async ({ page }) => {
    await page.route('**/api/tickets/analyze', (route) =>
      route.fulfill({
        status: 503,
        json: { detail: 'El modelo de clasificación no está disponible. Avisa al administrador.' },
      }),
    )

    await capture(page, CASES[0].text)

    await expect(page.getByRole('alert')).toHaveText(
      'El modelo de clasificación no está disponible. Avisa al administrador.',
    )
    await expect(page.getByLabel('Descripción del problema')).toBeEnabled()
  })
})
