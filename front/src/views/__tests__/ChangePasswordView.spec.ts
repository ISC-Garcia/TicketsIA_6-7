import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { setMockFailure } from '@/mocks/handlers'
import { createUser } from '@/services/users'
import { useSessionStore } from '@/stores/session'

import ChangePasswordView from '../ChangePasswordView.vue'

async function settle() {
  for (let round = 0; round < 3; round += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve))
  }
}

// Una técnica nueva que entra con su contraseña temporal.
async function signInAsNewUser() {
  const session = useSessionStore()
  await session.signIn('coordinador', 'demo2026')
  await createUser({
    name: 'Ana López',
    username: 'alopez',
    role: 'tecnico',
    password: 'temporal1',
  })
  await session.signIn('alopez', 'temporal1')
  return session
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/cambiar-contrasena', name: 'cambiar-contrasena', component: ChangePasswordView },
      { path: '/bandeja', name: 'bandeja', component: { render: () => h('div', 'Bandeja') } },
      { path: '/login', name: 'login', component: { render: () => h('div', 'Login') } },
    ],
  })
  await router.push('/cambiar-contrasena')
  const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [router] } })
  await settle()
  return { wrapper, router }
}

type Wrapper = Awaited<ReturnType<typeof mountView>>['wrapper']

async function fill(wrapper: Wrapper, current: string, next: string, confirm = next) {
  const inputs = wrapper.findAll('input')
  await inputs[0]!.setValue(current)
  await inputs[1]!.setValue(next)
  await inputs[2]!.setValue(confirm)
  await wrapper.find('form').trigger('submit')
  await settle()
}

const alerts = (wrapper: Wrapper) => wrapper.findAll('[role="alert"]').map((alert) => alert.text())

describe('ChangePasswordView', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('E5-03: saluda al usuario y valida antes de enviar', async () => {
    await signInAsNewUser()
    const { wrapper } = await mountView()

    expect(wrapper.text()).toContain('Hola, Ana López.')
    await fill(wrapper, '', 'corta', 'otra')

    expect(alerts(wrapper)).toEqual([
      'Escribe tu contraseña temporal.',
      'La contraseña debe tener al menos 8 caracteres.',
      'Las contraseñas no coinciden.',
    ])
  })

  it('E5-03: la nueva no puede ser igual a la temporal', async () => {
    await signInAsNewUser()
    const { wrapper } = await mountView()

    await fill(wrapper, 'temporal1', 'temporal1')

    expect(alerts(wrapper)).toEqual(['Debe ser distinta de la actual.'])
  })

  it('E5-03: muestra en su campo el rechazo de la API', async () => {
    await signInAsNewUser()
    const { wrapper } = await mountView()

    await fill(wrapper, 'equivocada', 'nueva-clave-1')

    expect(alerts(wrapper)).toEqual(['La contraseña actual no es correcta.'])
  })

  it('E5-03: al guardar entra a su inicio con una sesión completa', async () => {
    const session = await signInAsNewUser()
    const { wrapper, router } = await mountView()

    await fill(wrapper, 'temporal1', 'nueva-clave-1')

    expect(session.user?.mustChangePassword).toBe(false)
    expect(router.currentRoute.value.name).toBe('bandeja')
  })

  it('E5-03: sin conexión lo avisa', async () => {
    await signInAsNewUser()
    const { wrapper } = await mountView()
    setMockFailure(true)

    await fill(wrapper, 'temporal1', 'nueva-clave-1')

    expect(alerts(wrapper)).toEqual(['No se pudo conectar con el servidor.'])
  })

  it('E5-03: puede cerrar sesión sin cambiarla', async () => {
    const session = await signInAsNewUser()
    const { wrapper, router } = await mountView()

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Cerrar sesión')!
      .trigger('click')
    await settle()

    expect(session.isAuthenticated).toBe(false)
    expect(router.currentRoute.value.name).toBe('login')
  })
})
