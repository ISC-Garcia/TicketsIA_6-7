import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { useToastStore } from '@/stores/toast'

import AppToast from '../AppToast.vue'

describe('AppToast', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('mantiene la región de avisos aunque no haya ninguno', () => {
    const region = mount(AppToast).find('[role="status"]')

    expect(region.attributes('aria-live')).toBe('polite')
    expect(region.text()).toBe('')
  })

  it('muestra el mensaje y el detalle', async () => {
    const wrapper = mount(AppToast)

    useToastStore().show('Ticket resuelto', 'TCK-197420, 2.00 h')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.toast__message').text()).toBe('Ticket resuelto')
    expect(wrapper.find('.toast__detail').text()).toBe('TCK-197420, 2.00 h')
  })

  it('omite el detalle si no lo hay', async () => {
    const wrapper = mount(AppToast)

    useToastStore().show('Usuario creado')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.toast__detail').exists()).toBe(false)
  })

  it('se cierra con su botón', async () => {
    const wrapper = mount(AppToast)
    const toast = useToastStore()
    toast.show('Ticket resuelto')
    await wrapper.vm.$nextTick()

    await wrapper.find('button[aria-label="Cerrar notificación"]').trigger('click')

    expect(toast.current).toBeNull()
    expect(wrapper.find('.toast').exists()).toBe(false)
  })
})
