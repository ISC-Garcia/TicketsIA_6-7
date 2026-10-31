import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ConfirmDialog from '../ConfirmDialog.vue'

const mountDialog = (props = {}) =>
  mount(ConfirmDialog, { props: { title: '¿Continuar?', confirmLabel: 'Aceptar', ...props } })

describe('ConfirmDialog', () => {
  it('se abre como modal y se nombra con su título', () => {
    const wrapper = mountDialog()
    const dialog = wrapper.find('dialog')

    expect(dialog.attributes('open')).toBeDefined()
    expect(wrapper.find(`[id="${dialog.attributes('aria-labelledby')}"]`).text()).toBe(
      '¿Continuar?',
    )
  })

  it('omite el cuerpo si no lo recibe', () => {
    expect(mountDialog().find('p').exists()).toBe(false)
    expect(mountDialog({ body: 'Detalle' }).find('p').text()).toBe('Detalle')
  })

  it('emite cancelar y confirmar', async () => {
    const wrapper = mountDialog()
    const [cancel, confirm] = wrapper.findAll('button')

    await cancel?.trigger('click')
    await confirm?.trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('trata Escape como cancelar', async () => {
    const wrapper = mountDialog()

    await wrapper.find('dialog').trigger('cancel')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('usa el botón de peligro cuando se pide', () => {
    const wrapper = mountDialog({ danger: true })

    expect(wrapper.findAll('button')[1]?.classes()).toContain('button--danger')
  })
})
