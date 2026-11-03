import { describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { databaseStatus } from '@/mocks/database'
import { setMockFailure } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { MONITOR_PERIODS, type DatabaseStatus, type MonitorPeriod } from '@/types/database'

import MonitoringView from '../MonitoringView.vue'

async function settle() {
  for (let round = 0; round < 3; round += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve))
  }
}

async function mountMonitoring(path = '/monitoreo') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/monitoreo',
        name: 'monitoreo',
        component: MonitoringView,
        props: (route) => ({
          period:
            MONITOR_PERIODS.find((period) => period === route.query.periodo) ??
            ('24h' as MonitorPeriod),
        }),
      },
    ],
  })
  await router.push(path)
  const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [router] } })
  await settle()
  return { wrapper, router }
}

const indicators = (wrapper: VueWrapper) =>
  Object.fromEntries(
    wrapper
      .findAll('.monitor__indicator')
      .map((card) => [
        card.find('.monitor__indicator-label').text(),
        card.find('.monitor__indicator-value').text(),
      ]),
  )

const withStatus = (status: DatabaseStatus) =>
  server.use(http.get('*/api/database/status', () => HttpResponse.json(status)))

describe('MonitoringView', () => {
  it('E9-03: muestra los 7 indicadores de PostgreSQL', async () => {
    const { wrapper } = await mountMonitoring()

    expect(indicators(wrapper)).toEqual({
      'Estado del servidor': 'En línea',
      'Tiempo activo': '12 d 4 h',
      'Conexiones activas': '8 de 100',
      'Latencia promedio': '1.2 ms',
      'Consultas por minuto': '142',
      'Tamaño de la base de datos': '486 MB',
      'Aciertos de caché': '99.4 %',
    })
    expect(wrapper.find('.monitor__dot--online').exists()).toBe(true)
    expect(wrapper.find('.monitor__checked').text()).toBe('Actualizado a las 11:42:10')
  })

  it('E9-03: las gráficas dejan vacíos los tramos sin muestras', async () => {
    const { wrapper } = await mountMonitoring()

    const charts = wrapper.findAll('.line')
    expect(charts).toHaveLength(2)
    // 18 horas sin muestras y 6 con datos: una sola línea, sin unir lo que no se midió.
    expect(charts[0]!.findAll('polyline')).toHaveLength(1)
    expect(charts[0]!.find('polyline').attributes('points')!.split(' ')).toHaveLength(6)
    expect(charts[0]!.attributes('aria-label')).toContain('Consultas por hora. 06:00: 2,100')
    expect(charts[0]!.find('.line__end').text()).toBe('8,520')
    expect(charts[1]!.find('.line__end').text()).toBe('8')
  })

  it('E9-03: el periodo vive en la URL y vuelve a consultar', async () => {
    const { wrapper, router } = await mountMonitoring()

    await wrapper.findAll('[role="radio"]')[2]!.trigger('click')
    await settle()

    expect(router.currentRoute.value.query).toEqual({ periodo: 'mes' })
    expect(wrapper.findAll('.line__label').map((label) => label.text())).toContain('Día 30')

    await wrapper.findAll('[role="radio"]')[0]!.trigger('click')
    await settle()
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('E9-03: Actualizar vuelve a medir', async () => {
    let calls = 0
    server.use(
      http.get('*/api/database/status', () => {
        calls += 1
        return HttpResponse.json({
          ...databaseStatus('24h'),
          checkedAt: `2026-10-28 11:4${calls}:00`,
        })
      }),
    )
    const { wrapper } = await mountMonitoring()

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Actualizar')!
      .trigger('click')
    expect(wrapper.find('.monitor__checked').text()).toBe('Actualizando…')
    await settle()

    expect(calls).toBe(2)
    expect(wrapper.find('.monitor__checked').text()).toBe('Actualizado a las 11:42:00')
  })

  it('E9-03: lista las consultas más lentas', async () => {
    const { wrapper } = await mountMonitoring()

    const rows = wrapper
      .findAll('tbody tr')
      .map((row) => row.findAll('td').map((cell) => cell.text()))
    expect(rows[0]).toEqual(['SELECT count(*) FROM tickets WHERE status = $1', '120.4 ms', '1,284'])
    expect(rows[1]![2]).toBe('18,402')
  })

  it('E9-03: explica si pg_stat_statements no está activa o no hay consultas', async () => {
    withStatus({ ...databaseStatus('24h'), slowQueries: { available: false, items: [] } })
    const missing = await mountMonitoring()
    expect(missing.wrapper.text()).toContain('pg_stat_statements no está activa')

    withStatus({ ...databaseStatus('24h'), slowQueries: { available: true, items: [] } })
    const empty = await mountMonitoring()
    expect(empty.wrapper.text()).toContain('Aún no hay consultas registradas.')
  })

  it('E9-03: sin muestras todavía no inventa el ritmo de consultas', async () => {
    const status = databaseStatus('24h')
    const { queriesPerMinute: _, ...rest } = status
    withStatus({
      ...rest,
      trend: { ...status.trend!, queriesPerHour: status.trend!.queriesPerHour.map(() => null) },
    })
    const { wrapper } = await mountMonitoring()

    expect(indicators(wrapper)['Consultas por minuto']).toBe('—')
    expect(wrapper.find('.monitor__note').text()).toBe('Se calcula con la siguiente muestra')
    expect(wrapper.find('.line__empty').text()).toBe('Aún no hay muestras en este periodo.')
    expect(wrapper.findAll('.line')[0]!.attributes('aria-label')).toContain('Sin muestras')
  })

  it('E9-03: si PostgreSQL no responde lo dice', async () => {
    withStatus({ checkedAt: '2026-10-28 11:42:10', server: { online: false } })
    const { wrapper } = await mountMonitoring()

    expect(indicators(wrapper)).toMatchObject({
      'Estado del servidor': 'Sin conexión',
      'Tiempo activo': '—',
      'Conexiones activas': '—',
      'Latencia promedio': '—',
      'Consultas por minuto': '—',
      'Tamaño de la base de datos': '—',
      'Aciertos de caché': '—',
    })
    expect(wrapper.find('.monitor__dot--offline').exists()).toBe(true)
    expect(wrapper.find('.monitor__note').exists()).toBe(false)
    expect(wrapper.find('.line').exists()).toBe(false)
  })

  it('sin API muestra el error y permite reintentar', async () => {
    setMockFailure(true)
    const { wrapper } = await mountMonitoring()

    expect(wrapper.text()).toContain('No se pudo conectar con el servidor.')
    setMockFailure(false)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Reintentar')!
      .trigger('click')
    await settle()

    expect(indicators(wrapper)['Estado del servidor']).toBe('En línea')
  })

  it('si falla al actualizar conserva la última medición', async () => {
    const { wrapper } = await mountMonitoring()
    setMockFailure(true)

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Actualizar')!
      .trigger('click')
    await settle()

    expect(wrapper.find('[role="alert"]').text()).toBe('No se pudo conectar con el servidor.')
    expect(indicators(wrapper)['Estado del servidor']).toBe('En línea')
  })

  it('un error inesperado muestra un mensaje genérico', async () => {
    server.use(http.get('*/api/database/status', () => new HttpResponse('x', { status: 500 })))
    const { wrapper } = await mountMonitoring()

    expect(wrapper.text()).toMatch(/No se pudo/)
  })
})
