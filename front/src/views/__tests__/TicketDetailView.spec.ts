import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { http, HttpResponse } from 'msw'

import { setMockFailure } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { tickets } from '@/mocks/tickets'

import TicketDetailView from '../TicketDetailView.vue'

async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve))
  await flushPromises()
}

async function mountDetail(id: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/bandeja', name: 'bandeja', component: { render: () => h('div', 'Bandeja') } },
      { path: '/bandeja/:id', name: 'bandeja-detalle', component: TicketDetailView, props: true },
    ],
  })
  await router.push(`/bandeja/${id}`)

  const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [router] } })
  await settle()
  return { wrapper, router }
}

describe('TicketDetailView', () => {
  afterEach(() => setMockFailure(false))

  it('muestra el encabezado con ID, prioridad, estado y reporte', async () => {
    const { wrapper } = await mountDetail('TCK-200007')

    expect(wrapper.find('h1').text()).toBe('TCK-200007')
    expect(wrapper.find('.priority').text()).toBe('Crítica')
    expect(wrapper.find('.status').text()).toBe('En atención')
    expect(wrapper.find('.detail__summary').text()).toBe(
      'Caída total del Cluster K8s con alerta DEADLOCK_DB',
    )
    expect(wrapper.find('.detail__reporter').text()).toBe(
      'Reportado por Jorge Méndez Castillo, área de Operaciones',
    )
  })

  it.each([
    ['TCK-200007', 'SLA de 4 h', 'Vence en 50 min', 'detail__sla--risk', '79'],
    ['TCK-200021', 'SLA de 48 h', 'Vence en 22 h', 'detail__sla--normal', '54'],
    ['TCK-115796', 'SLA de 12 h', 'Resuelto en 2.00 h', 'detail__sla--met', '17'],
  ])('%s muestra la tarjeta de SLA', async (id, hours, label, tone, percent) => {
    const { wrapper } = await mountDetail(id)
    const card = wrapper.find('.detail__sla')

    expect(card.find('.detail__sla-hours').text()).toBe(hours)
    expect(card.find('.detail__sla-label').text()).toBe(label)
    expect(card.classes()).toContain(tone)
    expect(card.find('[role="progressbar"]').attributes('aria-valuenow')).toBe(percent)
  })

  it('recorre las tres pestañas', async () => {
    const { wrapper } = await mountDetail('TCK-115796')
    const tabs = wrapper.findAll('[role="tab"]')

    expect(tabs.map((tab) => tab.text())).toEqual(['Resumen', 'Análisis IA', 'Historial'])
    expect(wrapper.find('.summary').exists()).toBe(true)

    await tabs[1]!.trigger('click')
    expect(wrapper.find('.analysis').exists()).toBe(true)

    await tabs[2]!.trigger('click')
    expect(wrapper.findAll('.timeline__type').map((type) => type.text())).toEqual([
      'Ticket creado',
      'Clasificado por IA',
      'Cambio de estado',
      'Ticket resuelto',
      'Edición de datos',
    ])
    expect(wrapper.find('.timeline__badge').text()).toBe('Edición posterior al cierre')
  })

  it('al cambiar de ticket recarga y vuelve a Resumen', async () => {
    const { wrapper, router } = await mountDetail('TCK-200007')
    await wrapper.findAll('[role="tab"]')[2]!.trigger('click')

    await router.push('/bandeja/TCK-200003')
    await settle()

    expect(wrapper.find('h1').text()).toBe('TCK-200003')
    expect(wrapper.find('[role="tab"][aria-selected="true"]').text()).toBe('Resumen')
  })

  it('avisa si el ticket no existe y vuelve a la bandeja', async () => {
    const { wrapper, router } = await mountDetail('TCK-000000')

    expect(wrapper.text()).toContain('No se encontró el ticket TCK-000000')

    await wrapper.find('.empty button').trigger('click')
    await settle()

    expect(router.currentRoute.value.name).toBe('bandeja')
  })

  it('muestra el error de conexión y permite reintentar', async () => {
    setMockFailure(true)
    const { wrapper } = await mountDetail('TCK-200007')

    expect(wrapper.text()).toContain('No se pudo conectar con el servidor.')

    setMockFailure(false)
    await wrapper.find('.empty button').trigger('click')
    await settle()

    expect(wrapper.find('h1').text()).toBe('TCK-200007')
  })

  it('un ticket histórico no tiene técnico ni análisis', async () => {
    const {
      technician: _technician,
      analysis: _analysis,
      ...historic
    } = tickets.find((ticket) => ticket.id === 'TCK-115796')!
    server.use(http.get('*/api/tickets/TCK-100001', () => HttpResponse.json(historic)))
    server.use(http.get('*/api/tickets/TCK-100001/events', () => HttpResponse.json([])))
    const { wrapper } = await mountDetail('TCK-100001')

    expect(wrapper.find('.summary').text()).toContain('Sin asignar')
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    expect(wrapper.text()).toContain('Este ticket histórico no tiene análisis del modelo')
  })
})
