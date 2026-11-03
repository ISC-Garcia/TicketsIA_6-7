import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'

import BaseModal from '../BaseModal.vue'
import SidePanel from '../SidePanel.vue'

describe.each([
  ['SidePanel', SidePanel],
  ['BaseModal', BaseModal],
] as const)('%s', (_name, component) => {
  const mountOverlay = (props = {}, slots = {}) =>
    mount(component, {
      props: { title: 'Resolver ticket', ...props },
      slots: { default: () => h('p', 'Contenido'), ...slots },
      attachTo: document.body,
    })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('se abre como modal y se nombra con su título y subtítulo', () => {
    const wrapper = mountOverlay({ subtitle: 'TCK-197420' })
    const dialog = wrapper.find('dialog')

    expect(dialog.attributes('open')).toBeDefined()
    expect(wrapper.find(`[id="${dialog.attributes('aria-labelledby')}"]`).text()).toBe(
      'Resolver ticket',
    )
    expect(wrapper.find(`[id="${dialog.attributes('aria-describedby')}"]`).text()).toBe(
      'TCK-197420',
    )
  })

  it('omite subtítulo y pie si no los recibe', () => {
    const wrapper = mountOverlay()

    expect(wrapper.find('dialog').attributes('aria-describedby')).toBeUndefined()
    expect(wrapper.find('footer').exists()).toBe(false)
    expect(
      mountOverlay({}, { footer: () => h('button', 'Guardar') })
        .find('footer')
        .text(),
    ).toBe('Guardar')
  })

  it('trata Escape como cerrar', async () => {
    const wrapper = mountOverlay()

    await wrapper.find('dialog').trigger('cancel')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('se cierra con un clic en el fondo', async () => {
    const wrapper = mountOverlay()
    const dialog = wrapper.find('dialog')

    await dialog.trigger('pointerdown')
    await dialog.trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('no se cierra con clics dentro ni al arrastrar desde dentro', async () => {
    const wrapper = mountOverlay()
    const content = wrapper.find('p')

    await content.trigger('pointerdown')
    await content.trigger('click')
    await wrapper.find('dialog').trigger('click')

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('cierra el diálogo al desmontarse para devolver el foco', () => {
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close')
    const wrapper = mountOverlay()

    wrapper.unmount()

    expect(close).toHaveBeenCalledOnce()
    close.mockRestore()
  })
})

describe('SidePanel', () => {
  it('se cierra con su botón', async () => {
    const wrapper = mount(SidePanel, { props: { title: 'Resolver ticket' } })

    await wrapper.find('button[aria-label="Cerrar"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
