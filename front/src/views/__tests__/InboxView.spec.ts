import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { http, HttpResponse } from 'msw'

import { setMockFailure } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { tickets } from '@/mocks/tickets'
import { parseTicketFilters } from '@/utils/ticketFilters'

import InboxView from '../InboxView.vue'

async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve))
  await flushPromises()
}

async function mountInbox(path = '/bandeja') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/bandeja',
        name: 'bandeja',
        component: InboxView,
        props: (route) => ({ filters: parseTicketFilters(route.query) }),
      },
      { path: '/bandeja/:id', name: 'bandeja-detalle', component: { render: () => h('div') } },
    ],
  })
  await router.push(path)

  const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [router] } })
  await settle()
  return { wrapper, router }
}

const rowIds = (wrapper: Awaited<ReturnType<typeof mountInbox>>['wrapper']) =>
  wrapper.findAll('[role="rowgroup"]:last-child [role="row"] a').map((link) => link.text())

const priorityLabels = (wrapper: Awaited<ReturnType<typeof mountInbox>>['wrapper']) =>
  wrapper.findAll('[role="radio"]').map((option) => option.attributes('aria-label'))

describe('InboxView', () => {
  afterEach(() => setMockFailure(false))

  it('ordena por prioridad y antigüedad, con conteos por prioridad', async () => {
    const { wrapper } = await mountInbox()

    expect(rowIds(wrapper)).toEqual([
      'TCK-200007',
      'TCK-200003',
      'TCK-200014',
      'TCK-200011',
      'TCK-200021',
      'TCK-200018',
      'TCK-200029',
      'TCK-200025',
    ])
    expect(wrapper.find('.inbox__count').text()).toBe('8 tickets')
    expect(priorityLabels(wrapper)).toEqual([
      'Todos, 8 tickets',
      'Crítica, 2 tickets',
      'Alta, 2 tickets',
      'Media, 2 tickets',
      'Baja, 2 tickets',
    ])
  })

  it('muestra la antigüedad y el SLA de cada fila', async () => {
    const { wrapper } = await mountInbox()
    const first = wrapper.findAll('[role="rowgroup"]:last-child [role="row"]')[0]!

    expect(first.text()).toContain('3 h 10 min')
    expect(first.find('.sla__text').text()).toBe('50 min')
    expect(first.find('.sla').classes()).toContain('sla--risk')
  })

  it('filtra por prioridad y lo guarda en la URL', async () => {
    const { wrapper, router } = await mountInbox()

    await wrapper.findAll('[role="radio"]')[1]!.trigger('click')
    await settle()

    expect(router.currentRoute.value.query).toEqual({ prioridad: 'Crítica' })
    expect(rowIds(wrapper)).toEqual(['TCK-200007', 'TCK-200003'])
    expect(wrapper.find('.inbox__count').text()).toBe('2 tickets')
  })

  it('busca por texto y combina con otros filtros de la URL', async () => {
    const { wrapper, router } = await mountInbox(
      '/bandeja?departamento=Seguridad%20Inform%C3%A1tica',
    )

    await wrapper.find('input[type="search"]').setValue('dead')
    await settle()

    expect(router.currentRoute.value.query).toEqual({
      departamento: 'Seguridad Informática',
      q: 'dead',
    })
    expect(rowIds(wrapper)).toEqual(['TCK-200007'])
    expect(wrapper.find('.inbox__count').text()).toBe('1 ticket')
  })

  it('muestra los resueltos con su SLA y cuenta solo resueltos', async () => {
    const { wrapper } = await mountInbox('/bandeja?estado=Resuelto')

    expect(rowIds(wrapper)).toEqual(['TCK-115796'])
    expect(wrapper.find('.sla__text').text()).toBe('Cumplido')
    expect(priorityLabels(wrapper)).toEqual([
      'Todos, 1 ticket',
      'Crítica, 0 tickets',
      'Alta, 1 ticket',
      'Media, 0 tickets',
      'Baja, 0 tickets',
    ])
  })

  it('"Últimos 7 días" excluye tickets antiguos (H-5)', async () => {
    const { wrapper } = await mountInbox('/bandeja?estado=Resuelto&fecha=7')

    expect(rowIds(wrapper)).toEqual([])
    expect(wrapper.text()).toContain('No hay tickets que coincidan con los filtros')
  })

  it('limpia los filtros desde el estado vacío, incluida la búsqueda', async () => {
    const { wrapper, router } = await mountInbox('/bandeja?q=sin-coincidencias&prioridad=Baja')
    const input = wrapper.find('input[type="search"]').element as HTMLInputElement

    expect(input.value).toBe('sin-coincidencias')

    await wrapper.find('.empty button').trigger('click')
    await settle()

    expect(router.currentRoute.value.query).toEqual({})
    expect(input.value).toBe('')
    expect(rowIds(wrapper)).toHaveLength(8)
  })

  it('abre el detalle desde el enlace del ID o desde la fila', async () => {
    const { wrapper, router } = await mountInbox()
    const row = wrapper.findAll('[role="rowgroup"]:last-child [role="row"]')[2]!

    expect(row.find('a').attributes('href')).toBe('/bandeja/TCK-200014')

    await row.find('.sla').trigger('click')
    await settle()

    expect(router.currentRoute.value.fullPath).toBe('/bandeja/TCK-200014')
  })

  it('muestra el error de conexión y permite reintentar', async () => {
    setMockFailure(true)
    const { wrapper } = await mountInbox()

    expect(wrapper.text()).toContain('No se pudo conectar con el servidor.')
    expect(wrapper.find('.inbox__count').exists()).toBe(false)

    setMockFailure(false)
    await wrapper.find('.empty button').trigger('click')
    await settle()

    expect(rowIds(wrapper)).toHaveLength(8)
  })

  describe('paginación', () => {
    // 60 resueltos: la API devuelve 25 por página.
    function serveResolved(pages: string[]) {
      server.use(
        http.get('*/api/tickets', ({ request }) => {
          const params = new URL(request.url).searchParams
          pages.push(`${params.get('page') ?? '1'}/${params.get('pageSize')}`)
          return HttpResponse.json({ items: tickets.slice(0, 3), total: 60 })
        }),
      )
    }

    it('pide 25 por página y muestra el total real', async () => {
      const pages: string[] = []
      serveResolved(pages)
      const { wrapper } = await mountInbox('/bandeja?estado=Resuelto')

      expect(pages).toEqual(['1/25'])
      expect(wrapper.find('.inbox__count').text()).toBe('60 tickets')
      expect(wrapper.find('nav[aria-label="Paginación"]').text()).toContain(
        'Mostrando 1 a 25 de 60',
      )
    })

    it('avanza de página desde la URL y la reinicia al cambiar un filtro', async () => {
      const pages: string[] = []
      serveResolved(pages)
      const { wrapper, router } = await mountInbox('/bandeja?estado=Resuelto')

      await wrapper.findAll('nav[aria-label="Paginación"] button')[1]!.trigger('click')
      await settle()
      expect(router.currentRoute.value.query.pagina).toBe('2')
      expect(pages[pages.length - 1]).toBe('2/25')

      await wrapper.find('select[aria-label="Departamento"]').setValue('Redes y Conectividad')
      await settle()
      expect(router.currentRoute.value.query.pagina).toBeUndefined()
      expect(pages[pages.length - 1]).toBe('1/25')
    })

    it('sin más de una página no muestra la paginación', async () => {
      const { wrapper } = await mountInbox()

      expect(wrapper.find('nav[aria-label="Paginación"]').exists()).toBe(false)
    })
  })
})
