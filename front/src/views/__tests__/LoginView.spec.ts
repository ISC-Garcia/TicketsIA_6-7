import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setMockFailure } from '@/mocks/handlers'

import LoginView from '../LoginView.vue'

const SECTIONS = [
  ['/login', 'login'],
  ['/bandeja', 'bandeja'],
  ['/dashboard', 'dashboard'],
  ['/monitoreo', 'monitoreo'],
] as const

async function mountLogin() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: SECTIONS.map(([path, name]) => ({ path, name, component: { render: () => h('div') } })),
  })
  await router.push('/login')

  const wrapper = mount(LoginView, { global: { plugins: [router] } })
  return { wrapper, router }
}

async function submitWith(
  wrapper: Awaited<ReturnType<typeof mountLogin>>['wrapper'],
  username: string,
  password: string,
) {
  await wrapper.find('input[autocomplete="username"]').setValue(username)
  await wrapper.find('input[autocomplete="current-password"]').setValue(password)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve))
  await flushPromises()
}

describe('LoginView', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    setMockFailure(false)
    vi.unstubAllEnvs()
  })

  it('pide los dos campos antes de consultar', async () => {
    const { wrapper } = await mountLogin()

    await submitWith(wrapper, '   ', '')

    expect(wrapper.find('[role="alert"]').text()).toBe('Escribe tu usuario y contraseña.')
  })

  it('muestra el error de credenciales y permanece en login', async () => {
    const { wrapper, router } = await mountLogin()

    await submitWith(wrapper, 'tecnico', 'incorrecta')

    expect(wrapper.find('[role="alert"]').text()).toBe('Usuario o contraseña incorrectos.')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('muestra la falla de conexión', async () => {
    setMockFailure(true)
    const { wrapper } = await mountLogin()

    await submitWith(wrapper, 'tecnico', 'demo2026')

    expect(wrapper.find('[role="alert"]').text()).toBe('No se pudo conectar con el servidor.')
  })

  it.each([
    ['tecnico', '/bandeja'],
    ['coordinador', '/dashboard'],
    ['auditor', '/monitoreo'],
  ])('%s llega a %s', async (username, home) => {
    const { wrapper, router } = await mountLogin()

    await submitWith(wrapper, username, 'demo2026')

    expect(router.currentRoute.value.path).toBe(home)
  })

  it('muestra y oculta la contraseña', async () => {
    const { wrapper } = await mountLogin()
    const input = wrapper.find('input[autocomplete="current-password"]')
    const toggle = wrapper.find('button[aria-label="Mostrar contraseña"]')

    expect(input.attributes('type')).toBe('password')

    await toggle.trigger('click')

    expect(input.attributes('type')).toBe('text')
    expect(toggle.attributes('aria-label')).toBe('Ocultar contraseña')
  })

  it('oculta los accesos de demostración por defecto', async () => {
    const { wrapper } = await mountLogin()

    expect(wrapper.text()).not.toContain('Accesos de demostración')
  })

  it('con el modo demo, un acceso llena el formulario y limpia el error', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    const { wrapper } = await mountLogin()
    await submitWith(wrapper, 'tecnico', 'incorrecta')

    const coordinator = wrapper
      .findAll('.login__demo-row')
      .find((row) => row.text().includes('coordinador'))
    await coordinator?.trigger('click')

    const username = wrapper.find('input[autocomplete="username"]').element as HTMLInputElement
    const password = wrapper.find('input[autocomplete="current-password"]')
      .element as HTMLInputElement
    expect(username.value).toBe('coordinador')
    expect(password.value).toBe('demo2026')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
