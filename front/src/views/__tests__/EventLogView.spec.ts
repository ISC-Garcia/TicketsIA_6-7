import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { setMockFailure } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { parseEventFilters } from '@/utils/eventFilters'

import EventLogView from '../EventLogView.vue'

let mounted: VueWrapper | undefined

afterEach(() => {
  setMockFailure(false)
  mounted?.unmount()
  mounted = undefined
})

async function settle() {
  for (let round = 0; round < 3; round += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve))
  }
}

async function mountLog(path = '/bitacora') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/bitacora',
        name: 'bitacora',
        component: EventLogView,
        props: (route) => ({ filters: parseEventFilters(route.query) }),
      },
      { path: '/historial/:id?', name: 'historial', component: { render: () => h('div') } },
    ],
  })
  await router.push(path)
  mounted = mount(
    { render: () => h(RouterView) },
    { global: { plugins: [router] }, attachTo: document.body },
  )
  await settle()
  return { wrapper: mounted, router }
}

const rows = (wrapper: VueWrapper) => wrapper.findAll('.log__row:not(.log__row--head)')

describe('EventLogView', () => {
  it('E8-02: pagina de 10 en 10 desde la API, del más reciente al más antiguo', async () => {
    const { wrapper, router } = await mountLog()

    expect(rows(wrapper)).toHaveLength(10)
    expect(rows(wrapper)[0]!.text()).toContain('2026-10-28 10:14:08')
    expect(wrapper.find('.log__count').text()).toBe('31 eventos')
    expect(wrapper.text()).toContain('Mostrando 1 a 10 de 31')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Siguiente')!
      .trigger('click')
    await settle()

    expect(router.currentRoute.value.query).toEqual({ pagina: '2' })
    expect(wrapper.text()).toContain('Mostrando 11 a 20 de 31')
  })

  it('E8-02: los filtros viven en la URL y vuelven a la primera página', async () => {
    const { wrapper, router } = await mountLog('/bitacora?pagina=2')

    await wrapper.find('select[aria-label="Tipo de evento"]').setValue('Ticket creado')
    await settle()
    expect(router.currentRoute.value.query).toEqual({ tipo: 'Ticket creado' })

    await wrapper.find('select[aria-label="Usuario"]').setValue('Sarely Xala Hernández')
    await settle()
    await wrapper.find('select[aria-label="Rango de fechas"]').setValue('7')
    await settle()

    expect(router.currentRoute.value.query).toEqual({
      tipo: 'Ticket creado',
      usuario: 'Sarely Xala Hernández',
      fecha: '7',
    })
    expect(wrapper.find('.log__count').text()).toBe('4 eventos')
    expect(
      wrapper.findAll('select[aria-label="Usuario"] option').map((option) => option.text()),
    ).toContain('Sistema')
  })

  it('E8-02: busca el ticket por ID exacto al confirmar el campo', async () => {
    const { wrapper, router } = await mountLog()
    const input = wrapper.find('input[aria-label="Buscar por ID de ticket"]')

    await input.setValue(' tck-115796 ')
    expect(router.currentRoute.value.query).toEqual({})
    await input.trigger('change')
    await settle()

    expect(router.currentRoute.value.query).toEqual({ ticket: 'TCK-115796' })
    expect(wrapper.find('.log__count').text()).toBe('5 eventos')

    await input.setValue('')
    await input.trigger('change')
    await settle()
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('E8-02: el conmutador muestra su conteo y filtra las ediciones posteriores al cierre', async () => {
    const { wrapper, router } = await mountLog()
    const toggle = wrapper.find('.log__after-close')

    expect(toggle.text()).toContain('Solo ediciones posteriores al cierre')
    expect(wrapper.find('.log__after-close-count').text()).toBe('1')
    expect(toggle.attributes('aria-pressed')).toBe('false')

    await toggle.trigger('click')
    await settle()

    expect(router.currentRoute.value.query).toEqual({ posteriores: '1' })
    expect(wrapper.find('.log__after-close').attributes('aria-pressed')).toBe('true')
    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0]!.classes()).toContain('log__row--after-close')
    expect(rows(wrapper)[0]!.find('.log__badge').text()).toBe('Edición posterior al cierre')
    expect(wrapper.find('.log__count').text()).toBe('1 evento')

    await wrapper.find('.log__after-close').trigger('click')
    await settle()
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('E8-02: sin resultados ofrece limpiar los filtros', async () => {
    const { wrapper, router } = await mountLog('/bitacora?ticket=TCK-1&fecha=hoy')

    expect(wrapper.text()).toContain('No hay eventos que coincidan con los filtros')
    expect(wrapper.text()).not.toContain('Mostrando')

    const clear = wrapper.findAll('button').filter((button) => button.text() === 'Limpiar filtros')
    expect(clear).toHaveLength(2)
    await clear[1]!.trigger('click')
    await settle()

    expect(router.currentRoute.value.query).toEqual({})
    expect(rows(wrapper)).toHaveLength(10)
  })

  it('E8-02: el panel del evento muestra los cambios y lleva al historial', async () => {
    const { wrapper, router } = await mountLog('/bitacora?posteriores=1')

    await rows(wrapper)[0]!.trigger('click')
    await settle()

    const panel = wrapper.find('dialog')
    expect(panel.find('h2').text()).toBe('Edición de datos')
    expect(panel.find('.event__after-close').text()).toBe(
      'Edición posterior al cierre. El ticket se resolvió el 2025-12-09 04:12:45 y este cambio se hizo después.',
    )
    expect(panel.text()).toContain('Campos modificados')
    expect(panel.text()).toContain('10.25 h')
    expect(panel.text()).toContain('2.00 h')
    expect(panel.text()).not.toContain('Detalle')
    expect(rows(wrapper)[0]!.classes()).toContain('log__row--selected')

    await panel
      .findAll('button')
      .find((button) => button.text() === 'Ver historial del ticket')!
      .trigger('click')
    await settle()

    expect(router.currentRoute.value.fullPath).toBe('/historial/TCK-115796')
  })

  it('E8-02: el panel se cierra y no ofrece historial si el evento no tiene ticket', async () => {
    const { wrapper } = await mountLog('/bitacora?tipo=Inicio%20de%20sesi%C3%B3n')

    await rows(wrapper)[0]!.find('button').trigger('click')
    await settle()
    const panel = wrapper.find('dialog')
    expect(panel.text()).not.toContain('Ver historial del ticket')
    expect(panel.text()).not.toContain('Ticket')

    await panel
      .findAll('button')
      .find((button) => button.text() === 'Cerrar')!
      .trigger('click')
    await settle()
    expect(wrapper.find('dialog').exists()).toBe(false)
  })

  it('muestra el error del servidor y permite reintentar', async () => {
    setMockFailure(true)
    const { wrapper } = await mountLog()

    expect(wrapper.text()).toContain('No se pudo conectar con el servidor')
    setMockFailure(false)
    await wrapper.find('button.empty__action, .log__state button').trigger('click')
    await settle()

    expect(rows(wrapper)).toHaveLength(10)
  })

  it('un error inesperado muestra un mensaje genérico', async () => {
    server.use(http.get('*/api/events', () => HttpResponse.json(null), { once: true }))
    const { wrapper } = await mountLog()

    expect(wrapper.text()).toContain('No se pudo cargar la bitácora.')
  })
})
