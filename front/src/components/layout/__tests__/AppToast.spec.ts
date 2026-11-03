import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  describe('sobre los diálogos', () => {
    let open = false
    const showPopover = vi.fn<() => void>(() => {
      open = true
    })
    const hidePopover = vi.fn<() => void>(() => {
      open = false
    })

    beforeEach(() => {
      open = false
      Object.assign(HTMLElement.prototype, { showPopover, hidePopover })
      vi.spyOn(HTMLElement.prototype, 'matches').mockImplementation(function (
        this: HTMLElement,
        selector: string,
      ) {
        return selector === ':popover-open' && open
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
      showPopover.mockClear()
      hidePopover.mockClear()
      delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover
      delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover
    })

    it('E10-01: cada aviso vuelve a subir la región a la capa superior', async () => {
      const wrapper = mount(AppToast)
      expect(showPopover).toHaveBeenCalledTimes(1)

      useToastStore().show('Usuario creado')
      await wrapper.vm.$nextTick()

      expect(hidePopover).toHaveBeenCalledTimes(1)
      expect(showPopover).toHaveBeenCalledTimes(2)
    })
  })
})
