import { afterEach, describe, expect, it } from 'vitest'
import { type DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { setMockFailure } from '@/mocks/handlers'
import { modelMetrics } from '@/mocks/model'
import { server } from '@/mocks/server'
import { MODEL_TABS, type ModelTab } from '@/types/model'

import ModelView from '../ModelView.vue'

afterEach(() => setMockFailure(false))

async function settle() {
  for (let round = 0; round < 3; round += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve))
  }
}

async function mountModel(path = '/modelo') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/modelo/:tab?',
        name: 'modelo',
        component: ModelView,
        props: (route) => ({
          tab: MODEL_TABS.find((tab) => tab === route.params.tab) ?? ('metricas' as ModelTab),
        }),
      },
    ],
  })
  await router.push(path)
  const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [router] } })
  await settle()
  return { wrapper, router }
}

const texts = (wrapper: Pick<DOMWrapper<Element>, 'findAll'>, selector: string) =>
  wrapper.findAll(selector).map((node) => node.text())

describe('ModelView', () => {
  it('E7-02: muestra la exactitud contra el objetivo de 90 %', async () => {
    const { wrapper } = await mountModel()

    expect(wrapper.find('.model__subtitle').text()).toBe(
      'Evaluación sobre 14,882 tickets de prueba.',
    )
    expect(wrapper.find('.metrics__value').text()).toBe('94.6 %')
    expect(wrapper.find('.metrics__badge').text()).toBe('Cumplido')
    expect(wrapper.find('[role="meter"]').attributes('aria-valuenow')).toBe('94.64')
    expect(wrapper.find('.metrics__fill').attributes('style')).toContain('width: 94.64%')
  })

  it('E7-02: la tabla por clase usa barras en escala de 80 a 100 %', async () => {
    const { wrapper } = await mountModel()

    const critical = wrapper.findAll('tbody tr')[0]!
    expect(texts(critical, 'td')).toEqual(['94.1 %', '90.5 %', '92.3 %', '2,341'])
    // 90.47 % queda a la mitad de la escala de 80 a 100.
    expect(critical.findAll('.metrics__bar-fill')[1]!.attributes('style')).toContain('width: 52.3%')
    expect(critical.findAll('.metrics__number--strong')).toHaveLength(1)
    expect(texts(wrapper, 'tbody th')).toEqual(['Crítica', 'Alta', 'Media', 'Baja'])
  })

  it('E7-02: marca el objetivo como no cumplido bajo 90 %', async () => {
    server.use(
      http.get('*/api/model/metrics', () => HttpResponse.json({ ...modelMetrics, accuracy: 88.2 })),
    )
    const { wrapper } = await mountModel()

    expect(wrapper.find('.metrics__badge').text()).toBe('No cumplido')
    expect(wrapper.find('.metrics__badge').classes()).toContain('metrics__badge--missed')
  })

  it('E7-02: la matriz marca la diagonal y da el porcentaje por fila', async () => {
    const { wrapper } = await mountModel('/modelo/matriz')

    const cells = wrapper.findAll('.matrix__cell')
    expect(cells).toHaveLength(16)
    expect(cells[0]!.text()).toBe('2,11890.5 %')
    expect(cells[0]!.attributes('title')).toBe('Real Crítica, predicha Crítica: 2,118')
    expect(cells[1]!.attributes('title')).toBe('Real Crítica, predicha Alta: 67')
    expect(
      cells.flatMap((cell, index) => (cell.classes('matrix__cell--diagonal') ? [index] : [])),
    ).toEqual([0, 5, 10, 15])
    expect(cells[0]!.classes()).toContain('matrix__cell--dark')
    expect(cells[1]!.classes()).not.toContain('matrix__cell--dark')
    expect(wrapper.find('.matrix__diagonal').text()).toBe(
      'Diagonal: predicciones correctas, 14,085 de 14,882',
    )
  })

  it('E7-02: una fila sin tickets no divide entre cero', async () => {
    server.use(
      http.get('*/api/model/metrics', () =>
        HttpResponse.json({
          ...modelMetrics,
          confusionMatrix: {
            ...modelMetrics.confusionMatrix,
            matrix: [[0, 0, 0, 0], ...modelMetrics.confusionMatrix.matrix.slice(1)],
          },
        }),
      ),
    )
    const { wrapper } = await mountModel('/modelo/matriz')

    expect(wrapper.findAll('.matrix__cell')[0]!.text()).toBe('00.0 %')
  })

  it('E7-03: la división, la distribución y la limpieza cuadran con los registros limpios', async () => {
    const { wrapper } = await mountModel('/modelo/datos')

    expect(wrapper.find('.data__subtitle').text()).toBe('99,209 registros limpios, 70 / 15 / 15')
    expect(texts(wrapper, '.data__split-labels dd')).toEqual([
      '69,446 registros',
      '14,881 registros',
      '14,882 registros',
    ])
    expect(texts(wrapper, '.data__bar-value')).toEqual([
      '15,611 15.7 %',
      '20,302 20.5 %',
      '34,013 34.3 %',
      '29,283 29.5 %',
    ])
    expect(texts(wrapper, '.data__step-value')).toEqual(['102,000', '−1,786', '−1,005', '99,209'])
    expect(texts(wrapper, '.data__imputed-value')).toEqual(['4,078', '4,061', '514'])
  })

  it('E7-03: la ficha da el algoritmo, sus parámetros y cómo se construyó el dataset', async () => {
    const { wrapper } = await mountModel('/modelo/modelo')

    const rows = Object.fromEntries(
      wrapper.findAll('.sheet__row').map((row) => [row.find('dt').text(), row.find('dd').text()]),
    )
    expect(rows).toMatchObject({
      Algoritmo: 'Random Forest',
      Árboles: '100',
      'Balanceo de clases': 'Pesos balanceados por clase',
      'Técnica de texto': 'TF-IDF con 1,000 términos',
      'Variables de entrada':
        'Descripción del problema (texto vectorizado) y, con One-Hot Encoding: área solicitante, dispositivo afectado, departamento y sentimiento',
      'Exactitud con el contexto del dataset': '94.57 %, frente a 94.64 % con el contexto predicho',
      // Se entrenó a las 12:53 UTC: en la mesa de ayuda eran las 06:53.
      'Fecha de entrenamiento': '2026-11-03 06:53',
      'SHA-256 del modelo': modelMetrics.modelSha256,
    })
    expect(rows['Departamento y sentimiento']).toContain('Aciertan 46.0 % el departamento')
    const notes = wrapper.find('.sheet__notes').text()
    expect(notes).toContain('5 % de las etiquetas')
    expect(notes).toContain('tres departamentos para Crítica y Alta')
  })

  it('E7-03: la ficha nombra las variables que no conoce y otros parámetros', async () => {
    server.use(
      http.get('*/api/model/metrics', () =>
        HttpResponse.json({
          ...modelMetrics,
          parameters: {
            ...modelMetrics.parameters,
            classWeight: 'none',
            categoryFeatures: ['canal'],
          },
        }),
      ),
    )
    const { wrapper } = await mountModel('/modelo/modelo')

    const values = texts(wrapper, '.sheet__row dd')
    expect(values).toContain('Sin balanceo')
    expect(values).toContain(
      'Descripción del problema (texto vectorizado) y, con One-Hot Encoding: canal',
    )
  })

  it('E7-03: cada pestaña cambia la URL y la URL abre la pestaña', async () => {
    const { wrapper, router } = await mountModel('/modelo/datos')
    expect(wrapper.find('[aria-selected="true"]').text()).toBe('Datos de entrenamiento')

    const tabs = wrapper.findAll('[role="tab"]')
    await tabs[1]!.trigger('click')
    await settle()
    expect(router.currentRoute.value.fullPath).toBe('/modelo/matriz')
    expect(wrapper.find('.matrix').exists()).toBe(true)

    await tabs[0]!.trigger('click')
    await settle()
    expect(router.currentRoute.value.fullPath).toBe('/modelo')
    expect(wrapper.find('.metrics').exists()).toBe(true)
  })

  it('sin modelo muestra el error de la API y permite reintentar', async () => {
    server.use(
      http.get(
        '*/api/model/metrics',
        () =>
          HttpResponse.json(
            { detail: 'El modelo de clasificación no está disponible.' },
            { status: 503 },
          ),
        { once: true },
      ),
    )
    const { wrapper } = await mountModel()

    expect(wrapper.text()).toContain('El modelo de clasificación no está disponible.')
    expect(wrapper.find('.model__subtitle').text()).toBe('Sin métricas disponibles.')

    await wrapper.find('button').trigger('click')
    await settle()
    expect(wrapper.find('.metrics__value').text()).toBe('94.6 %')
  })
})
