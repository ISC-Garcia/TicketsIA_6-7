import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { setMockFailure } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { DASHBOARD_PERIODS, type DashboardPeriod } from '@/types/dashboard'

import DashboardView from '../DashboardView.vue'

async function settle() {
  for (let round = 0; round < 3; round += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve))
  }
}

async function mountDashboard(path = '/dashboard') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/dashboard',
        name: 'dashboard',
        component: DashboardView,
        props: (route) => ({
          period:
            DASHBOARD_PERIODS.find((period) => period === route.query.periodo) ??
            ('mes' as DashboardPeriod),
        }),
      },
      { path: '/general', name: 'general', component: { render: () => h('div') } },
      { path: '/general/:id', name: 'general-detalle', component: { render: () => h('div') } },
    ],
  })
  await router.push(path)
  const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [router] } })
  await settle()
  return { wrapper, router }
}

const kpis = (wrapper: Awaited<ReturnType<typeof mountDashboard>>['wrapper']) =>
  wrapper.findAll('.dashboard__kpi').map((card) => ({
    value: card.find('.dashboard__kpi-value').text(),
    comparison: card.find('.dashboard__kpi-comparison').text(),
    tone: card.find('.dashboard__delta').exists()
      ? card
          .find('.dashboard__delta')
          .classes()
          .find((name) => name.includes('--'))
      : undefined,
  }))

describe('DashboardView', () => {
  it('E6-02: muestra los 4 KPI con su variación y tono', async () => {
    const { wrapper } = await mountDashboard()

    expect(kpis(wrapper)).toEqual([
      { value: '8', comparison: '+5 frente a hace 7 días', tone: 'dashboard__delta--neutral' },
      { value: '2', comparison: '−1 frente a hace 7 días', tone: 'dashboard__delta--good' },
      {
        value: '25.6 h',
        comparison: '−1.8 h frente a los 30 días anteriores',
        tone: 'dashboard__delta--good',
      },
      {
        value: '91.8 %',
        comparison: '+0.6 pts frente a los 30 días anteriores',
        tone: 'dashboard__delta--good',
      },
    ])
  })

  it('E6-02: sin resueltos recientes lo dice en lugar de inventar un valor', async () => {
    server.use(
      http.get('*/api/dashboard', () =>
        HttpResponse.json({
          kpis: {
            openTickets: 3,
            openTicketsBefore: 5,
            criticalOpen: 1,
            criticalOpenBefore: 0,
            averageResolutionHours: null,
            averageResolutionHoursBefore: null,
            slaCompliance: 80,
            slaComplianceBefore: null,
          },
          byPriority: [],
          total: 0,
          byDepartment: [],
          trend: {
            period: 'mes',
            subtitle: 'Último mes, por semana',
            labels: [],
            created: [],
            resolved: [],
          },
          resolutionVsSla: [],
          critical: [],
        }),
      ),
    )
    const { wrapper } = await mountDashboard()

    const cards = kpis(wrapper)
    expect(cards[1]!.tone).toBe('dashboard__delta--bad')
    expect(cards[2]).toEqual({
      value: '—',
      comparison: 'Sin tickets resueltos en los últimos 30 días',
      tone: undefined,
    })
    expect(cards[3]!.value).toBe('80.0 %')
    expect(wrapper.find('.dashboard__no-critical').text()).toBe(
      'No hay tickets críticos pendientes.',
    )
  })

  it('E6-02: las barras muestran conteo y porcentaje del total', async () => {
    const { wrapper } = await mountDashboard()

    const priority = wrapper.findAll('.dashboard__chart')[0]!
    expect(priority.find('.dashboard__chart-subtitle').text()).toBe(
      'Todos los tickets registrados, 9',
    )
    expect(priority.findAll('.bars__label').map((label) => label.text())).toEqual([
      'Crítica',
      'Alta',
      'Media',
      'Baja',
    ])
    expect(priority.findAll('.bars__value')[1]!.text()).toBe('3 33.3 %')
  })

  it('E6-02: cambiar el periodo actualiza la URL y la tendencia', async () => {
    const { wrapper, router } = await mountDashboard()
    expect(wrapper.text()).toContain('Último mes, por semana')

    await wrapper.findAll('[role="radio"]')[0]!.trigger('click')
    await settle()

    expect(router.currentRoute.value.query.periodo).toBe('semana')
    expect(wrapper.text()).toContain('Última semana, por día')
    expect(wrapper.findAll('.trend__label')).toHaveLength(7)

    await wrapper.findAll('[role="radio"]')[1]!.trigger('click')
    await settle()
    expect(router.currentRoute.value.query.periodo).toBeUndefined()
  })

  it('E6-02: lista los críticos sin resolver con enlace a su detalle', async () => {
    const { wrapper } = await mountDashboard('/dashboard?periodo=año')

    expect(wrapper.text()).toContain('Último año, por mes')
    const links = wrapper.findAll('.dashboard__id')
    expect(links.map((link) => link.text())).toEqual(['TCK-200007', 'TCK-200003'])
    expect(links[0]!.attributes('href')).toBe('/general/TCK-200007')
    expect(wrapper.find('.dashboard__link').attributes('href')).toBe('/general')
  })

  it('E6-02: muestra el error de conexión y permite reintentar', async () => {
    setMockFailure(true)
    const { wrapper } = await mountDashboard()

    expect(wrapper.text()).toContain('No se pudo conectar con el servidor.')

    setMockFailure(false)
    await wrapper.find('.empty button').trigger('click')
    await settle()
    expect(wrapper.findAll('.dashboard__kpi')).toHaveLength(4)
  })
})
