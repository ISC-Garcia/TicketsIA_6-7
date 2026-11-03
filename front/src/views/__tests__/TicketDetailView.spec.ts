import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { http, HttpResponse } from 'msw'

import { setMockFailure } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { tickets } from '@/mocks/tickets'
import { users } from '@/mocks/users'
import { setAuthToken } from '@/services/http'
import { useSessionStore } from '@/stores/session'
import { useToastStore } from '@/stores/toast'

import TicketDetailView from '../TicketDetailView.vue'

async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve))
  await flushPromises()
}

// Inicia la sesión simulada: los manejadores de MSW reconocen el token `simulado-<usuario>`.
function signInAs(username: string) {
  const session = useSessionStore()
  session.user = users.find((user) => user.username === username)!
  setAuthToken(`simulado-${username}`)
}

async function mountDetail(id: string, username = 'tecnico') {
  setActivePinia(createPinia())
  signInAs(username)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/bandeja', name: 'bandeja', component: { render: () => h('div', 'Bandeja') } },
      {
        path: '/bandeja/:id',
        name: 'bandeja-detalle',
        component: TicketDetailView,
        props: true,
        meta: { parent: 'bandeja' },
      },
      { path: '/general', name: 'general', component: { render: () => h('div', 'General') } },
      {
        path: '/general/:id',
        name: 'general-detalle',
        component: TicketDetailView,
        props: true,
        meta: { parent: 'general' },
      },
    ],
  })
  await router.push(`/${username === 'coordinador' ? 'general' : 'bandeja'}/${id}`)

  const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [router] } })
  await settle()
  return { wrapper, router }
}

const buttonNamed = (wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper'], name: string) =>
  wrapper.findAll('button').find((button) => button.text() === name)

describe('TicketDetailView', () => {
  afterEach(() => {
    setMockFailure(false)
    setAuthToken(null)
  })

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

  describe('atención', () => {
    it('E4-02: el técnico asignado atiende un ticket abierto', async () => {
      const { wrapper } = await mountDetail('TCK-200003')

      await buttonNamed(wrapper, 'Atender')!.trigger('click')
      await settle()

      expect(wrapper.find('.status').text()).toBe('En atención')
      expect(buttonNamed(wrapper, 'Atender')).toBeUndefined()
      expect(buttonNamed(wrapper, 'Marcar como resuelto')).toBeDefined()
      expect(useToastStore().current).toMatchObject({ message: 'Ticket en atención' })
    })

    it('E4-02: un ticket de otro técnico dice a quién está asignado', async () => {
      const { wrapper } = await mountDetail('TCK-200011')

      expect(buttonNamed(wrapper, 'Atender')).toBeUndefined()
      expect(wrapper.find('.detail__assigned').text()).toBe('Asignado a Sarely Xala Hernández')
    })

    it('E4-02: si la API rechaza la acción muestra el motivo', async () => {
      server.use(
        http.post('*/api/tickets/:id/attend', () =>
          HttpResponse.json({ detail: 'El ticket ya está en atención.' }, { status: 409 }),
        ),
      )
      const { wrapper } = await mountDetail('TCK-200003')

      await buttonNamed(wrapper, 'Atender')!.trigger('click')
      await settle()

      expect(wrapper.find('.detail__action-error').text()).toBe('El ticket ya está en atención.')
    })

    it('E4-05: el coordinador ve el detalle en solo lectura y vuelve a su bandeja', async () => {
      const { wrapper, router } = await mountDetail('TCK-200003', 'coordinador')

      expect(wrapper.find('.detail__read-only').text()).toBe('Solo lectura')
      expect(buttonNamed(wrapper, 'Atender')).toBeUndefined()
      expect(wrapper.find('.detail__actions').exists()).toBe(false)

      await router.push('/general/TCK-000000')
      await settle()
      await wrapper.find('.empty button').trigger('click')
      await settle()
      expect(router.currentRoute.value.name).toBe('general')
    })

    it('un ticket resuelto por otro técnico no ofrece acciones', async () => {
      const { wrapper } = await mountDetail('TCK-115796', 'tecnico')

      expect(wrapper.find('.detail__actions').exists()).toBe(false)
    })
  })

  describe('E4-03: resolver', () => {
    async function openResolve() {
      const mounted = await mountDetail('TCK-200007')
      await buttonNamed(mounted.wrapper, 'Marcar como resuelto')!.trigger('click')
      return mounted
    }

    const lastDialog = (wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper']) => {
      const dialogs = wrapper.findAll('dialog')
      return dialogs[dialogs.length - 1]!
    }

    const panel = (wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper']) =>
      wrapper.findAll('dialog').find((dialog) => dialog.text().includes('Solución aplicada'))!

    it('precalcula las horas desde el registro y valida la captura', async () => {
      const { wrapper } = await openResolve()
      const resolve = panel(wrapper)

      expect((resolve.find('input').element as HTMLInputElement).value).toBe('3.17')
      expect(resolve.text()).toContain('Calculado desde el registro del ticket (08:32)')

      await resolve.find('input').setValue('0')
      await resolve.find('form').trigger('submit')

      expect(resolve.findAll('[role="alert"]').map((alert) => alert.text())).toEqual([
        'Describe la solución aplicada (mínimo 10 caracteres).',
        'Escribe un tiempo válido en horas.',
      ])
    })

    it('pide confirmación, guarda y muestra el resultado con el historial', async () => {
      const { wrapper } = await openResolve()
      const resolve = panel(wrapper)
      await resolve.find('textarea').setValue('Se reinició el nodo principal del cluster.')
      await resolve.find('input').setValue('2,5')

      await resolve.find('form').trigger('submit')
      const confirm = wrapper
        .findAll('dialog')
        .find((dialog) => dialog.text().includes('¿Confirmar la resolución de TCK-200007?'))!
      await confirm
        .findAll('button')
        .find((button) => button.text() === 'Confirmar resolución')!
        .trigger('click')
      await settle()

      expect(panel(wrapper).text()).toContain(
        'Ticket TCK-200007 resuelto en 2.50 h por Roberto García Hernández',
      )
      expect(wrapper.find('.status').text()).toBe('Resuelto')
      expect(wrapper.find('.detail__sla-label').text()).toBe('Resuelto en 2.50 h')
      expect(useToastStore().current).toMatchObject({
        message: 'Ticket resuelto',
        detail: 'TCK-200007, 2.50 h',
      })

      await buttonNamed(wrapper, 'Ver historial del ticket')!.trigger('click')
      expect(wrapper.find('[role="tab"][aria-selected="true"]').text()).toBe('Historial')
      expect(wrapper.findAll('dialog')).toHaveLength(0)
    })

    it('cancelar la confirmación vuelve al formulario', async () => {
      const { wrapper } = await openResolve()
      const resolve = panel(wrapper)
      await resolve.find('textarea').setValue('Se reinició el nodo principal del cluster.')
      await resolve.find('form').trigger('submit')

      await lastDialog(wrapper)
        .findAll('button')
        .find((b) => b.text() === 'Cancelar')!
        .trigger('click')

      expect(panel(wrapper).find('textarea').exists()).toBe(true)
    })

    it('muestra los errores de la API en el formulario', async () => {
      server.use(
        http.post('*/api/tickets/:id/resolve', () =>
          HttpResponse.json({ detail: 'Atiende el ticket antes de resolverlo.' }, { status: 409 }),
        ),
      )
      const { wrapper } = await openResolve()
      const resolve = panel(wrapper)
      await resolve.find('textarea').setValue('Se reinició el nodo principal del cluster.')
      await resolve.find('form').trigger('submit')

      await lastDialog(wrapper)
        .findAll('button')
        .find((b) => b.text() === 'Confirmar resolución')!
        .trigger('click')
      await settle()

      expect(panel(wrapper).find('.resolve__error').text()).toBe(
        'Atiende el ticket antes de resolverlo.',
      )
    })
  })

  describe('E4-07: corregir la resolución', () => {
    const lastDialog = (wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper']) => {
      const dialogs = wrapper.findAll('dialog')
      return dialogs[dialogs.length - 1]!
    }

    it('quien resolvió corrige las horas y queda la edición posterior al cierre', async () => {
      const { wrapper } = await mountDetail('TCK-115796', 'sxala')
      await buttonNamed(wrapper, 'Corregir resolución')!.trigger('click')

      const panel = wrapper.find('dialog')
      expect(panel.find('h2').text()).toBe('Corregir resolución')
      expect((panel.find('textarea').element as HTMLTextAreaElement).value).toContain(
        'módulo de energía',
      )
      expect((panel.find('input').element as HTMLInputElement).value).toBe('2.00')
      expect(panel.text()).toContain('Registrado: 2.00 h.')

      await panel.find('input').setValue('3.25')
      await panel.find('form').trigger('submit')
      expect(lastDialog(wrapper).text()).toContain('¿Guardar la corrección de TCK-115796?')
      await lastDialog(wrapper)
        .findAll('button')
        .find((button) => button.text() === 'Guardar corrección')!
        .trigger('click')
      await settle()

      expect(wrapper.find('dialog').text()).toContain('Resolución de TCK-115796 corregida: 3.25 h')
      expect(wrapper.find('.detail__sla-label').text()).toBe('Resuelto en 3.25 h')
      expect(useToastStore().current).toMatchObject({
        message: 'Resolución corregida',
        detail: 'TCK-115796, 3.25 h',
      })
    })

    it('muestra el motivo si no hay cambios', async () => {
      const { wrapper } = await mountDetail('TCK-115796', 'sxala')
      await buttonNamed(wrapper, 'Corregir resolución')!.trigger('click')

      await wrapper.find('dialog form').trigger('submit')
      await lastDialog(wrapper)
        .findAll('button')
        .find((button) => button.text() === 'Guardar corrección')!
        .trigger('click')
      await settle()

      expect(wrapper.find('.resolve__error').text()).toBe('No hay cambios que guardar.')
    })
  })
})
