import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from '@/App.vue'
import { TICK_MS } from '@/composables/useNow'
import { forgetVisits, rememberVisit } from '@/router/lastVisited'
import { routes } from '@/router/routes'
import { useSessionStore } from '@/stores/session'
import type { Role } from '@/types/user'
import { syncClock } from '@/utils/clock'

async function mountAt(path: string, role: Role = 'tecnico') {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSessionStore().user = {
    name: 'Roberto García Hernández',
    username: 'tecnico',
    role,
    active: true,
  }

  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  await flushPromises()

  const wrapper = mount(App, { global: { plugins: [router, pinia] } })
  await flushPromises()
  return { wrapper, router }
}

const labels = (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) =>
  wrapper.findAll('.sidebar__link').map((link) => link.attributes('aria-label'))

const breadcrumbs = (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) =>
  wrapper.findAll('.header__crumb').map((crumb) => crumb.text())

describe('AppLayout', () => {
  beforeEach(() => {
    forgetVisits()
    localStorage.clear()
    sessionStorage.clear()
  })

  it.each([
    ['tecnico', '/bandeja', ['Registrar ticket', 'Bandeja de incidentes']],
    [
      'coordinador',
      '/dashboard',
      ['Dashboard', 'Bandeja general', 'Rendimiento del modelo', 'Gestión de usuarios'],
    ],
    [
      'auditor',
      '/monitoreo',
      ['Monitoreo de base de datos', 'Bitácora de registros', 'Historial de ticket'],
    ],
  ] as const)('muestra el menú del rol %s', async (role, path, expected) => {
    const { wrapper } = await mountAt(path, role)

    expect(labels(wrapper)).toEqual(expected)
  })

  it('marca la sección activa también en el detalle', async () => {
    const { wrapper } = await mountAt('/bandeja/TCK-200003')

    expect(wrapper.find('[aria-current="page"].sidebar__link').attributes('aria-label')).toBe(
      'Bandeja de incidentes',
    )
  })

  it('muestra usuario, iniciales y etiqueta del rol', async () => {
    const { wrapper } = await mountAt('/bandeja')

    expect(wrapper.find('.sidebar__avatar').text()).toBe('RG')
    expect(wrapper.find('.sidebar__user-role').text()).toBe('Técnico de TI')
  })

  it('contrae el sidebar y actualiza su etiqueta', async () => {
    const { wrapper } = await mountAt('/bandeja')
    const toggle = wrapper.find('.sidebar__toggle')

    expect(toggle.attributes('aria-label')).toBe('Contraer barra lateral')

    await toggle.trigger('click')

    expect(wrapper.find('.sidebar').classes()).toContain('sidebar--collapsed')
    expect(toggle.attributes('aria-label')).toBe('Expandir barra lateral')
  })

  it('el modo solo lectura aparece solo para el auditor', async () => {
    const auditor = await mountAt('/monitoreo', 'auditor')
    const technician = await mountAt('/bandeja', 'tecnico')

    expect(auditor.wrapper.text()).toContain('Modo solo lectura')
    expect(technician.wrapper.text()).not.toContain('Modo solo lectura')
  })

  it('muestra la fecha del sistema', async () => {
    const { wrapper } = await mountAt('/bandeja')

    expect(wrapper.find('.header__date').text()).toBe('Miércoles, 28 de octubre de 2026')
  })

  it('E11-02: la fecha es la del servidor y cambia sola al pasar la medianoche', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    // Horas locales, sin zona: la prueba vale en cualquier zona horaria del equipo.
    syncClock(new Date('2026-11-03T23:59:50').toISOString())
    const { wrapper } = await mountAt('/bandeja')
    expect(wrapper.find('.header__date').text()).toBe('Martes, 3 de noviembre de 2026')

    syncClock(new Date('2026-11-04T00:00:20').toISOString())
    await vi.advanceTimersByTimeAsync(TICK_MS)

    expect(wrapper.find('.header__date').text()).toBe('Miércoles, 4 de noviembre de 2026')
    vi.useRealTimers()
  })

  describe('breadcrumbs', () => {
    it('una sección simple es solo texto', async () => {
      const { wrapper } = await mountAt('/dashboard', 'coordinador')

      expect(breadcrumbs(wrapper)).toEqual(['Dashboard de carga de trabajo'])
      expect(wrapper.find('a.header__crumb').exists()).toBe(false)
    })

    it('el breadcrumb del detalle vuelve a la bandeja con sus filtros', async () => {
      rememberVisit({ name: 'bandeja', query: { prioridad: 'Alta', q: 'red' }, params: {} })
      const { wrapper } = await mountAt('/bandeja/TCK-200011')

      expect(wrapper.find('a.header__crumb').attributes('href')).toBe(
        '/bandeja?prioridad=Alta&q=red',
      )
    })

    it('el detalle enlaza a su bandeja y muestra el ID', async () => {
      const { wrapper } = await mountAt('/general/TCK-200003', 'coordinador')

      expect(breadcrumbs(wrapper)).toEqual(['Bandeja general', 'TCK-200003'])
      expect(wrapper.find('a.header__crumb').attributes('href')).toBe('/general')
      expect(wrapper.find('.header__crumb--mono').text()).toBe('TCK-200003')
    })

    it.each([
      ['/modelo', 'Métricas'],
      ['/modelo/matriz', 'Matriz de confusión'],
      ['/modelo/no-existe', 'Métricas'],
    ])('%s muestra la pestaña %s', async (path, tab) => {
      const { wrapper } = await mountAt(path, 'coordinador')

      expect(breadcrumbs(wrapper)).toEqual(['Rendimiento del modelo', tab])
    })
  })

  describe('cerrar sesión', () => {
    const openConfirmation = async (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) => {
      await wrapper.find('.sidebar__logout').trigger('click')
      return wrapper.find('dialog')
    }

    it('pide confirmación antes de cerrar', async () => {
      const { wrapper } = await mountAt('/bandeja')

      const dialog = await openConfirmation(wrapper)

      expect(dialog.text()).toContain('¿Deseas cerrar sesión?')
      expect(useSessionStore().isAuthenticated).toBe(true)
    })

    it('cancelar conserva la sesión', async () => {
      const { wrapper } = await mountAt('/bandeja')
      const dialog = await openConfirmation(wrapper)

      await dialog.findAll('button')[0]?.trigger('click')

      expect(wrapper.find('dialog').exists()).toBe(false)
      expect(useSessionStore().isAuthenticated).toBe(true)
    })

    it('confirmar limpia la sesión y vuelve al login', async () => {
      sessionStorage.setItem('tickets.session', '{}')
      const { wrapper, router } = await mountAt('/bandeja')
      const dialog = await openConfirmation(wrapper)

      await dialog.findAll('button')[1]?.trigger('click')

      await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
      expect(useSessionStore().isAuthenticated).toBe(false)
      expect(sessionStorage.getItem('tickets.session')).toBeNull()
    })
  })
})
