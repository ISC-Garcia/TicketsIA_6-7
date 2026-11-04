import type { APIRequestContext, Page } from '@playwright/test'

import type { ModelMetrics } from '../src/types/model'
import { API_URL } from '../playwright.config'
import { expect, test } from './fixtures'

async function signInAsCoordinator(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill('coordinador')
  await page.getByLabel('Contraseña', { exact: true }).fill('demo2026')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

// El modelo cargado depende de cómo se entrenó (en CI, con 10,000 registros): las pruebas
// comparan la pantalla con su `metricas.json` en lugar de fijar cifras.
async function loadedMetrics(request: APIRequestContext): Promise<ModelMetrics> {
  const login = await request.post(`${API_URL}/api/auth/login`, {
    data: { username: 'coordinador', password: 'demo2026' },
  })
  const { token } = await login.json()
  const response = await request.get(`${API_URL}/api/model/metrics`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.ok(), 'la API de pruebas debe tener un modelo cargado').toBe(true)
  return response.json()
}

const number = (value: number) => value.toLocaleString('es-MX')
const percent = (value: number) => `${value.toFixed(1)} %`

test.describe('E7-04: rendimiento del modelo', () => {
  test('las cuatro pestañas muestran los valores de metricas.json', async ({ page, request }) => {
    const metrics = await loadedMetrics(request)
    await signInAsCoordinator(page)

    await page.getByRole('link', { name: 'Rendimiento del modelo' }).click()
    await expect(page).toHaveURL(/\/modelo$/)
    await expect(
      page.getByText(`Evaluación sobre ${number(metrics.split.test)} tickets de prueba.`),
    ).toBeVisible()

    // Métricas
    await expect(page.locator('.metrics__value')).toHaveText(percent(metrics.accuracy))
    for (const row of metrics.classes) {
      await expect(page.getByRole('row').filter({ hasText: row.priority })).toContainText(
        [percent(row.precision), percent(row.recall), percent(row.f1), number(row.support)].join(
          '',
        ),
      )
    }

    // Matriz de confusión
    await page.getByRole('tab', { name: 'Matriz de confusión' }).click()
    await expect(page).toHaveURL(/\/modelo\/matriz$/)
    await expect(page.getByRole('navigation', { name: 'Ruta' })).toContainText(
      'Matriz de confusión',
    )
    const { labels, matrix } = metrics.confusionMatrix
    const correct = matrix.reduce((sum, row, index) => sum + row[index]!, 0)
    const total = matrix.flat().reduce((sum, count) => sum + count, 0)
    await expect(page.getByText(`Diagonal: predicciones correctas, ${number(correct)}`)).toHaveText(
      `Diagonal: predicciones correctas, ${number(correct)} de ${number(total)}`,
    )
    await expect(
      page.getByTitle(`Real ${labels[0]}, predicha ${labels[0]}: ${number(matrix[0]![0]!)}`),
    ).toBeVisible()
    await expect(page.locator('.matrix__cell')).toHaveCount(16)

    // Datos de entrenamiento
    await page.getByRole('tab', { name: 'Datos de entrenamiento' }).click()
    await expect(page).toHaveURL(/\/modelo\/datos$/)
    await expect(
      page.getByText(`${number(metrics.cleaning.cleanRecords)} registros limpios`),
    ).toBeVisible()
    await expect(page.getByText(`${number(metrics.split.train)} registros`)).toBeVisible()
    await expect(page.locator('.data__step-value').first()).toHaveText(
      number(metrics.cleaning.rawRecords),
    )

    // Modelo
    await page.getByRole('tab', { name: 'Modelo', exact: true }).click()
    await expect(page).toHaveURL(/\/modelo\/modelo$/)
    await expect(page.getByText(metrics.modelSha256)).toBeVisible()
    await expect(page.getByText(metrics.parameters.algorithm, { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cómo se construyó el dataset' })).toBeVisible()
  })

  test('la URL abre directamente una pestaña y el breadcrumb la nombra', async ({ page }) => {
    await signInAsCoordinator(page)

    await page.goto('/modelo/datos')

    await expect(page.getByRole('tab', { name: 'Datos de entrenamiento' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByRole('heading', { name: 'División del dataset' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Ruta' })).toContainText(
      'Datos de entrenamiento',
    )

    // El primer nivel del breadcrumb vuelve a la pestaña inicial.
    await page.getByRole('navigation', { name: 'Ruta' }).getByRole('link').click()
    await expect(page).toHaveURL(/\/modelo$/)
    await expect(page.getByRole('tab', { name: 'Métricas' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})
