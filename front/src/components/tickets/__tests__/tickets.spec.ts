import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import type { Priority } from '@/types/ticket'

import PriorityFilter from '../PriorityFilter.vue'
import SlaCell from '../SlaCell.vue'

describe('SlaCell', () => {
  it.each([
    [{ ageMinutes: 105 }, '2 h 15 min', 'sla--normal', '44'],
    [{ ageMinutes: 190 }, '50 min', 'sla--risk', '79'],
    [{ ageMinutes: 300 }, 'Vencido', 'sla--overdue', '100'],
    [{ ageMinutes: 300, resolutionHours: 3 }, 'Cumplido', 'sla--met', '100'],
    [{ ageMinutes: 300, resolutionHours: 5 }, 'Incumplido', 'sla--missed', '100'],
  ])('%o muestra %s', (props, text, tone, percent) => {
    const wrapper = mount(SlaCell, { props: { priority: 'Crítica', ...props } })

    expect(wrapper.find('.sla__text').text()).toBe(text)
    expect(wrapper.classes()).toContain(tone)
    expect(wrapper.find('[role="progressbar"]').attributes('aria-valuenow')).toBe(percent)
  })
})

describe('PriorityFilter', () => {
  const counts = { Crítica: 2, Alta: 3, Media: 0, Baja: 1 }

  it('nombra Todos con el total y cada prioridad con su conteo', () => {
    const wrapper = mount(PriorityFilter, { props: { modelValue: '', counts } })

    expect(
      wrapper.findAll('[role="radio"]').map((option) => option.attributes('aria-label')),
    ).toEqual([
      'Todos, 6 tickets',
      'Crítica, 2 tickets',
      'Alta, 3 tickets',
      'Media, 0 tickets',
      'Baja, 1 ticket',
    ])
  })

  it('marca la opción activa y solo ella entra con Tab', () => {
    const wrapper = mount(PriorityFilter, { props: { modelValue: 'Alta', counts } })
    const options = wrapper.findAll('[role="radio"]')

    expect(options.map((option) => option.attributes('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
      'false',
      'false',
    ])
    expect(options.map((option) => option.attributes('tabindex'))).toEqual([
      '-1',
      '-1',
      '0',
      '-1',
      '-1',
    ])
  })

  it('cambia con clic y con flechas', async () => {
    const wrapper = mount(PriorityFilter, {
      props: {
        modelValue: '' as Priority | '',
        counts,
        'onUpdate:modelValue': (value: Priority | '') => wrapper.setProps({ modelValue: value }),
      },
    })

    await wrapper.findAll('[role="radio"]')[1]?.trigger('click')
    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted('update:modelValue')).toEqual([['Crítica'], ['Alta']])
  })

  it('mueve el foco con flechas aunque la selección llegue después', async () => {
    const wrapper = mount(PriorityFilter, {
      props: { modelValue: '', counts },
      attachTo: document.body,
    })

    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' })

    expect(document.activeElement?.getAttribute('aria-label')).toBe('Crítica, 2 tickets')
    wrapper.unmount()
  })
})
