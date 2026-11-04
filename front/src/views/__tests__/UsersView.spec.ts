import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { setMockFailure } from '@/mocks/handlers'
import { useSessionStore } from '@/stores/session'
import { useToastStore } from '@/stores/toast'

import UsersView from '../UsersView.vue'

async function settle() {
  for (let round = 0; round < 3; round += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve))
  }
}

async function mountUsers() {
  setActivePinia(createPinia())
  await useSessionStore().signIn('coordinador', 'demo2026')
  const wrapper = mount(UsersView, { attachTo: document.body })
  await settle()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountUsers>>

const rows = (wrapper: Wrapper) =>
  wrapper.findAll('[role="rowgroup"]:last-child [role="row"]').map((row) => row.text())

const button = (wrapper: Wrapper, label: string) =>
  wrapper.findAll('button').find((candidate) => candidate.text() === label)

const rowOf = (wrapper: Wrapper, username: string) =>
  wrapper.findAll('[role="row"]').find((row) => row.text().includes(username))!

describe('UsersView', () => {
  beforeEach(() => sessionStorage.clear())

  it('E5-02: lista los usuarios con su rol, estado y la sesión actual', async () => {
    const wrapper = await mountUsers()

    expect(wrapper.find('.users__subtitle').text()).toBe('4 usuarios activos de 4')
    expect(rows(wrapper)).toHaveLength(4)
    expect(rowOf(wrapper, 'coordinador').text()).toContain('Sesión actual')
    expect(rowOf(wrapper, 'coordinador').find('button').exists()).toBe(false)
    expect(rowOf(wrapper, 'sxala').text()).toContain('Técnico de TI')
    wrapper.unmount()
  })

  it('E5-02: desactivar pide confirmación y reactivar es directo', async () => {
    const wrapper = await mountUsers()

    await rowOf(wrapper, 'sxala').find('button').trigger('click')
    const confirm = wrapper.find('dialog')
    expect(confirm.text()).toContain('¿Desactivar a Sarely Xala Hernández?')
    expect(confirm.text()).toContain('Sus tickets y registros se conservan.')
    await confirm
      .findAll('button')
      .find((b) => b.text() === 'Desactivar')!
      .trigger('click')
    await settle()

    expect(rowOf(wrapper, 'sxala').text()).toContain('Inactivo')
    expect(rowOf(wrapper, 'sxala').classes()).toContain('users__row--inactive')
    expect(wrapper.find('.users__subtitle').text()).toBe('3 usuarios activos de 4')
    expect(useToastStore().current).toMatchObject({ message: 'Usuario desactivado' })

    await rowOf(wrapper, 'sxala').find('button').trigger('click')
    await settle()
    expect(rowOf(wrapper, 'sxala').text()).toContain('Activo')
    expect(useToastStore().current).toMatchObject({ message: 'Usuario reactivado' })
    wrapper.unmount()
  })

  it('E5-02: cancelar la confirmación no desactiva', async () => {
    const wrapper = await mountUsers()

    await rowOf(wrapper, 'auditor').find('button').trigger('click')
    await wrapper
      .find('dialog')
      .findAll('button')
      .find((b) => b.text() === 'Cancelar')!
      .trigger('click')

    expect(rowOf(wrapper, 'auditor').text()).toContain('Activo')
    wrapper.unmount()
  })

  it('E5-02: crea un usuario con validaciones y lo agrega a la lista', async () => {
    const wrapper = await mountUsers()
    await button(wrapper, 'Nuevo usuario')!.trigger('click')
    const panel = wrapper.find('dialog')
    const inputs = panel.findAll('input')

    await inputs[1]!.setValue('Ana')
    await panel.find('form').trigger('submit')
    expect(panel.findAll('[role="alert"]').map((alert) => alert.text())).toEqual([
      'Escribe el nombre completo.',
      'Usa al menos 3 caracteres: minúsculas, números, punto o guion bajo.',
      'La contraseña debe tener al menos 8 caracteres.',
    ])

    await inputs[1]!.setValue('sxala')
    await panel.find('form').trigger('submit')
    expect(panel.find('[role="alert"]').exists()).toBe(true)
    expect(panel.text()).toContain('Ese usuario ya existe.')

    await inputs[0]!.setValue('  Ana López Ruiz ')
    await inputs[1]!.setValue('alopez')
    await panel.find('select').setValue('auditor')
    await inputs[2]!.setValue('temporal1')
    await panel.find('form').trigger('submit')
    await settle()

    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(rows(wrapper)).toHaveLength(5)
    expect(rowOf(wrapper, 'alopez').text()).toContain('Auditor de sistemas')
    expect(useToastStore().current).toMatchObject({
      message: 'Usuario creado',
      detail: 'Ana López Ruiz, Auditor de sistemas',
    })
    wrapper.unmount()
  })

  it('E5-02: el usuario repetido que detecta la API aparece en su campo', async () => {
    const wrapper = await mountUsers()
    await button(wrapper, 'Nuevo usuario')!.trigger('click')
    const panel = wrapper.find('dialog')
    const inputs = panel.findAll('input')
    // Otro coordinador lo creó mientras tanto: la lista local no lo tiene.
    const { createUser } = await import('@/services/users')
    await createUser({ name: 'Otra', username: 'otra.ana', role: 'tecnico', password: 'temporal1' })

    await inputs[0]!.setValue('Ana')
    await inputs[1]!.setValue('otra.ana')
    await inputs[2]!.setValue('temporal1')
    await panel.find('form').trigger('submit')
    await settle()

    expect(panel.text()).toContain('Ese usuario ya existe.')
    wrapper.unmount()
  })

  it('E5-02: muestra el error de conexión y permite reintentar', async () => {
    setActivePinia(createPinia())
    await useSessionStore().signIn('coordinador', 'demo2026')
    setMockFailure(true)
    const wrapper = mount(UsersView)
    await settle()

    expect(wrapper.text()).toContain('No se pudo conectar con el servidor.')

    setMockFailure(false)
    await wrapper.find('.empty button').trigger('click')
    await settle()
    expect(rows(wrapper)).toHaveLength(4)
  })

  it('E5-02: si falla la desactivación lo avisa', async () => {
    const wrapper = await mountUsers()
    await rowOf(wrapper, 'sxala').find('button').trigger('click')
    setMockFailure(true)

    await wrapper
      .find('dialog')
      .findAll('button')
      .find((b) => b.text() === 'Desactivar')!
      .trigger('click')
    await settle()

    expect(wrapper.find('.users__error').text()).toBe('No se pudo conectar con el servidor.')
    wrapper.unmount()
  })
})
