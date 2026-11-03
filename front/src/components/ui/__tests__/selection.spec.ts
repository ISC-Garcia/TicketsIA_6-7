import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'

import BaseTabs from '../BaseTabs.vue'
import SegmentedControl from '../SegmentedControl.vue'

const OPTIONS = [
  { key: 'a', label: 'Uno' },
  { key: 'b', label: 'Dos' },
  { key: 'c', label: 'Tres' },
] as const

describe('BaseTabs', () => {
  it('solo la pestaña activa entra en el orden de Tab', () => {
    const wrapper = mount(BaseTabs, {
      props: { tabs: OPTIONS, label: 'Secciones', modelValue: 'b' },
    })
    const tabs = wrapper.findAll('[role="tab"]')

    expect(tabs.map((tab) => tab.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
    expect(tabs[1]?.attributes('aria-selected')).toBe('true')
  })

  it.each([
    ['ArrowRight', 'a', 'b'],
    ['ArrowLeft', 'a', 'c'],
    ['ArrowRight', 'c', 'a'],
    ['Home', 'c', 'a'],
    ['End', 'a', 'c'],
  ] as const)('%s desde %s selecciona %s', async (key, from, expected) => {
    const updates: string[] = []
    const wrapper = mount(BaseTabs, {
      props: {
        tabs: OPTIONS,
        label: 'Secciones',
        modelValue: from,
        'onUpdate:modelValue': (value: string) => updates.push(value),
      },
    })

    await wrapper.find('[role="tablist"]').trigger('keydown', { key })

    expect(updates).toEqual([expected])
  })

  it('ignora otras teclas', async () => {
    const updates: string[] = []
    const wrapper = mount(BaseTabs, {
      props: {
        tabs: OPTIONS,
        label: 'Secciones',
        modelValue: 'a',
        'onUpdate:modelValue': (value: string) => updates.push(value),
      },
    })

    await wrapper.find('[role="tablist"]').trigger('keydown', { key: 'a' })

    expect(updates).toEqual([])
  })

  it('mueve el foco a la pestaña seleccionada', async () => {
    const wrapper = mount(BaseTabs, {
      attachTo: document.body,
      props: {
        tabs: OPTIONS,
        label: 'Secciones',
        modelValue: 'a',
        'onUpdate:modelValue': (value: string) => {
          wrapper.setProps({ modelValue: value })
        },
      },
    })

    await wrapper.find('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    await nextTick()

    expect(document.activeElement?.textContent?.trim()).toBe('Dos')
    wrapper.unmount()
  })

  it('enlaza el panel con la pestaña activa', () => {
    const wrapper = mount(BaseTabs, {
      props: { tabs: OPTIONS, label: 'Secciones', modelValue: 'c' },
    })

    const activeTab = wrapper.find('[aria-selected="true"]')

    expect(wrapper.find('[role="tabpanel"]').attributes('aria-labelledby')).toBe(
      activeTab.attributes('id'),
    )
  })
})

describe('SegmentedControl', () => {
  it('marca la opción activa', () => {
    const wrapper = mount(SegmentedControl, {
      props: { options: OPTIONS, label: 'Periodo', modelValue: 'b' },
    })

    expect(
      wrapper.findAll('[role="radio"]').map((radio) => radio.attributes('aria-checked')),
    ).toEqual(['false', 'true', 'false'])
  })

  it('cambia de opción con flechas y con clic', async () => {
    const updates: string[] = []
    const wrapper = mount(SegmentedControl, {
      props: {
        options: OPTIONS,
        label: 'Periodo',
        modelValue: 'a',
        'onUpdate:modelValue': (value: string) => updates.push(value),
      },
    })

    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' })
    await wrapper.findAll('[role="radio"]')[2]?.trigger('click')

    expect(updates).toEqual(['b', 'c'])
  })
})
