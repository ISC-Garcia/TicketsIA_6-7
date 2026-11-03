import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import RowActions from '../RowActions.vue'

async function openMenu() {
  const wrapper = mount(RowActions, { props: { ticketId: 'TCK-200007' }, attachTo: document.body })
  await wrapper.find('button').trigger('click')
  await nextTick()
  return wrapper
}

describe('RowActions', () => {
  it('abre el menú y enfoca la primera opción', async () => {
    const wrapper = await openMenu()

    expect(wrapper.find('button').attributes('aria-expanded')).toBe('true')
    expect(document.activeElement?.textContent?.trim()).toBe('Reasignar')
    wrapper.unmount()
  })

  it('un clic fuera lo cierra', async () => {
    const wrapper = await openMenu()

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('un clic dentro no lo cierra', async () => {
    const wrapper = await openMenu()

    wrapper.find('[role="menu"]').element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()

    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('Escape lo cierra y devuelve el foco al botón', async () => {
    const wrapper = await openMenu()

    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.find('button').element)
    wrapper.unmount()
  })

  it('elegir Reasignar cierra el menú y avisa', async () => {
    const wrapper = await openMenu()

    await wrapper.find('[role="menuitem"]').trigger('click')

    expect(wrapper.emitted('reassign')).toHaveLength(1)
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
