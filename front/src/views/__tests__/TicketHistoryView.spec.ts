import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { setMockFailure } from '@/mocks/handlers'
import { server } from '@/mocks/server'

import TicketHistoryView from '../TicketHistoryView.vue'

let mounted: VueWrapper | undefined

afterEach(() => {
  mounted?.unmount()
  mounted = undefined
})

async function settle() {
  for (let round = 0; round < 3; round += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve))
  }
}

async function mountHistory(path = '/historial') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/historial/:id?',
        name: 'historial',
        component: TicketHistoryView,
        props: (route) => ({
          id: typeof route.params.id === 'string' ? route.params.id.toUpperCase() : undefined,
        }),
      },
    ],
  })
  await router.push(path)
  mounted = mount({ render: () => h(RouterView) }, { global: { plugins: [router] } })
  await settle()
  return { wrapper: mounted, router }
}

const fields = (wrapper: VueWrapper) =>
  Object.fromEntries(
    wrapper.findAll('.history__field').map((row) => [row.find('dt').text(), row.find('dd').text()]),
  )

describe('TicketHistoryView', () => {
  it('E8-03: los ejemplos salen de la bitácora', async () => {
    const { wrapper } = await mountHistory()

    // El movimiento más reciente es de TCK-200011 y la edición posterior al cierre, de TCK-115796.
    expect(wrapper.findAll('.history__example').map((button) => button.text())).toEqual([
      'TCK-200011',
      'TCK-115796',
    ])
    expect(wrapper.find('.history__ticket').exists()).toBe(false)
  })

  it('E8-03: valida el formato antes de consultar', async () => {
    const { wrapper, router } = await mountHistory()

    await wrapper.find('input').setValue('TCK-12')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('[role="alert"]').text()).toBe('Escribe un ID con el formato TCK-000000.')
    expect(wrapper.find('input').attributes('aria-invalid')).toBe('true')
    expect(router.currentRoute.value.fullPath).toBe('/historial')
  })

  it('E8-03: un ID mal escrito en la URL también avisa', async () => {
    const { wrapper } = await mountHistory('/historial/115796')

    expect(wrapper.find('[role="alert"]').text()).toBe('Escribe un ID con el formato TCK-000000.')
  })

  it('E8-03: consulta, refleja el ID en la URL y resalta la edición posterior al cierre', async () => {
    const { wrapper, router } = await mountHistory()

    await wrapper.find('input').setValue(' tck-115796 ')
    await wrapper.find('form').trigger('submit')
    await settle()

    expect(router.currentRoute.value.fullPath).toBe('/historial/TCK-115796')
    expect(wrapper.find('.history__ticket-id').text()).toBe('TCK-115796')
    expect(fields(wrapper)).toEqual({
      'Área solicitante': 'Operaciones',
      Departamento: 'Redes y Conectividad',
      'Técnico asignado': 'Sarely Xala Hernández',
      'Tiempo de resolución': 'Edición posterior al cierre 2.00 h',
    })
    const events = wrapper.findAll('.timeline__event')
    expect(events).toHaveLength(5)
    expect(events[4]!.classes()).toContain('timeline__event--after-close')
    expect(events[4]!.text()).toContain('10.25 h')
  })

  it('E8-03: un ticket sin resolver dice que no tiene tiempo de resolución', async () => {
    const { wrapper } = await mountHistory('/historial/tck-200003')

    expect(fields(wrapper)['Tiempo de resolución']).toBe('Sin resolver')
    expect(wrapper.find('.history__badge').exists()).toBe(false)
  })

  it('E8-03: los ejemplos abren su historial y repetir la consulta la recarga', async () => {
    const { wrapper, router } = await mountHistory()

    await wrapper.findAll('.history__example')[0]!.trigger('click')
    await settle()
    expect(router.currentRoute.value.fullPath).toBe('/historial/TCK-200011')

    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('[role="status"]').text()).toBe('Consultando bitácora…')
    await settle()
    expect(wrapper.find('.history__ticket-id').text()).toBe('TCK-200011')
  })

  it('E8-03: avisa si no existe el ticket', async () => {
    const { wrapper } = await mountHistory('/historial/TCK-000001')

    expect(wrapper.text()).toContain('No se encontró ningún ticket con ese ID')
    expect(wrapper.find('.history__mono').text()).toBe('TCK-000001')
  })

  it('E8-03: un ticket sin movimientos lo dice', async () => {
    server.use(http.get('*/api/tickets/:id/events', () => HttpResponse.json([])))
    const { wrapper } = await mountHistory('/historial/TCK-200003')

    expect(wrapper.text()).toContain('Este ticket no tiene movimientos en la bitácora.')
  })

  it('volver al historial sin ID limpia el resultado', async () => {
    const { wrapper, router } = await mountHistory('/historial/TCK-200003')

    await router.push('/historial')
    await settle()

    expect(wrapper.find('.history__ticket').exists()).toBe(false)
    expect(wrapper.find('input').element.value).toBe('')
  })

  it('sin conexión muestra el error, sin ejemplos, y permite reintentar', async () => {
    setMockFailure(true)
    const { wrapper } = await mountHistory('/historial/TCK-200003')

    expect(wrapper.text()).toContain('No se pudo conectar con el servidor.')
    expect(wrapper.find('.history__examples').exists()).toBe(false)

    setMockFailure(false)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Reintentar')!
      .trigger('click')
    await settle()
    expect(wrapper.find('.history__ticket-id').text()).toBe('TCK-200003')
  })
})
