import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'

import BaseButton from '../BaseButton.vue'
import EmptyState from '../EmptyState.vue'
import FormField from '../FormField.vue'
import PaginationBar from '../PaginationBar.vue'
import PriorityBadge from '../PriorityBadge.vue'
import ProgressBar from '../ProgressBar.vue'
import StatusBadge from '../StatusBadge.vue'

describe('BaseButton', () => {
  it('no envía formularios salvo que se pida', () => {
    expect(mount(BaseButton).attributes('type')).toBe('button')
    expect(mount(BaseButton, { props: { type: 'submit' } }).attributes('type')).toBe('submit')
  })
})

describe('badges', () => {
  it.each([
    ['Crítica', 'priority--critical'],
    ['Alta', 'priority--high'],
    ['Media', 'priority--medium'],
    ['Baja', 'priority--low'],
  ] as const)('prioridad %s usa %s', (priority, expected) => {
    const wrapper = mount(PriorityBadge, { props: { priority } })

    expect(wrapper.classes()).toContain(expected)
    expect(wrapper.text()).toBe(priority)
  })

  it.each([
    ['Abierto', 'status--open'],
    ['En atención', 'status--progress'],
    ['Resuelto', 'status--resolved'],
  ] as const)('estado %s usa %s', (status, expected) => {
    expect(mount(StatusBadge, { props: { status } }).classes()).toContain(expected)
  })
})

describe('FormField', () => {
  const mountField = (props: { error?: string; hint?: string }) =>
    mount(FormField, {
      props: { label: 'Usuario', ...props },
      slots: {
        default: ({ id, invalid, describedBy }: Record<string, unknown>) =>
          h('input', { id, 'aria-invalid': invalid, 'aria-describedby': describedBy }),
      },
    })

  it('asocia la etiqueta con el campo', () => {
    const wrapper = mountField({})

    expect(wrapper.find('label').attributes('for')).toBe(wrapper.find('input').attributes('id'))
    expect(wrapper.find('input').attributes('aria-describedby')).toBeUndefined()
  })

  it('anuncia el error y lo describe junto con la ayuda', () => {
    const wrapper = mountField({ error: 'Campo obligatorio', hint: 'Ayuda' })
    const describedBy = wrapper.find('input').attributes('aria-describedby')?.split(' ') ?? []

    expect(wrapper.find('[role="alert"]').text()).toBe('Campo obligatorio')
    expect(wrapper.find('input').attributes('aria-invalid')).toBe('true')
    expect(describedBy).toHaveLength(2)
    describedBy.forEach((id) => expect(wrapper.find(`[id="${id}"]`).exists()).toBe(true))
  })
})

describe('PaginationBar', () => {
  const mountBar = (page: number, total: number) =>
    mount(PaginationBar, { props: { page, pageSize: 10, total } })

  it('muestra el rango de la página', () => {
    expect(mountBar(1, 37).text()).toContain('Mostrando 1 a 10 de 37')
    expect(mountBar(4, 37).text()).toContain('Mostrando 31 a 37 de 37')
  })

  it('deshabilita los extremos', () => {
    const [firstPrev, firstNext] = mountBar(1, 37).findAll('button')
    const [lastPrev, lastNext] = mountBar(4, 37).findAll('button')

    expect(firstPrev?.attributes('disabled')).toBeDefined()
    expect(firstNext?.attributes('disabled')).toBeUndefined()
    expect(lastPrev?.attributes('disabled')).toBeUndefined()
    expect(lastNext?.attributes('disabled')).toBeDefined()
  })

  it('avanza y retrocede', async () => {
    const wrapper = mountBar(2, 37)
    const [previous, next] = wrapper.findAll('button')

    await next?.trigger('click')
    await previous?.trigger('click')

    expect(wrapper.emitted('update:page')).toEqual([[3], [2]])
  })
})

describe('ProgressBar', () => {
  it.each([
    [-5, '0'],
    [62.4, '62'],
    [140, '100'],
  ])('limita %s a %s', (value, expected) => {
    const wrapper = mount(ProgressBar, { props: { value, label: 'Progreso' } })

    expect(wrapper.attributes('aria-valuenow')).toBe(expected)
  })
})

describe('EmptyState', () => {
  it('oculta la acción si no tiene etiqueta', () => {
    expect(
      mount(EmptyState, { props: { title: 'Sin datos' } })
        .find('button')
        .exists(),
    ).toBe(false)
  })

  it('emite la acción', async () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'Sin datos', actionLabel: 'Limpiar filtros' },
    })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('action')).toHaveLength(1)
  })
})
