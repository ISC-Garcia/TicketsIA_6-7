import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import { tickets } from '@/mocks/tickets'
import type { AuditEvent } from '@/types/event'
import type { Ticket } from '@/types/ticket'

import ChangeComparison from '../ChangeComparison.vue'
import TicketAnalysis from '../TicketAnalysis.vue'
import TicketSummary from '../TicketSummary.vue'
import TicketTimeline from '../TicketTimeline.vue'

const ticketById = (id: string) => tickets.find((ticket) => ticket.id === id) as Ticket

describe('ChangeComparison', () => {
  const change = { field: 'Tiempo de resolución', oldValue: '10.25 h', newValue: '2.00 h' }

  it('muestra el campo con su valor anterior y nuevo', () => {
    const wrapper = mount(ChangeComparison, { props: { change } })

    expect(wrapper.find('.change__field').text()).toBe('Tiempo de resolución')
    expect(wrapper.findAll('.change__value').map((value) => value.text())).toEqual([
      'Valor anterior10.25 h',
      'Valor nuevo2.00 h',
    ])
    expect(wrapper.find('.change__values--after-close').exists()).toBe(false)
  })

  it('marca las ediciones posteriores al cierre', () => {
    const wrapper = mount(ChangeComparison, { props: { change, afterClose: true } })

    expect(wrapper.find('.change__values--after-close').exists()).toBe(true)
  })
})

describe('TicketTimeline', () => {
  const events: AuditEvent[] = [
    {
      id: '1',
      time: '2025-12-08 17:57:45',
      user: 'Ana',
      type: 'Ticket creado',
      detail: 'Reportado',
    },
    {
      id: '2',
      time: '2025-12-09 04:12:45',
      user: 'Ana',
      type: 'Ticket resuelto',
      detail: '10.25 h',
    },
    {
      id: '3',
      time: '2026-10-27 18:40:22',
      user: 'Francisco',
      type: 'Edición de datos',
      detail: 'tiempo de resolución 10.25 h a 2.00 h',
      changes: [{ field: 'Tiempo de resolución', oldValue: '10.25 h', newValue: '2.00 h' }],
      afterClose: true,
    },
  ]

  it('lista los eventos en el orden recibido como lista ordenada', () => {
    const wrapper = mount(TicketTimeline, { props: { events } })

    expect(wrapper.element.tagName).toBe('OL')
    expect(wrapper.findAll('.timeline__type').map((type) => type.text())).toEqual([
      'Ticket creado',
      'Ticket resuelto',
      'Edición de datos',
    ])
    expect(wrapper.find('time').attributes('datetime')).toBe('2025-12-08T17:57:45')
  })

  it('explica la resolución y usa la comparación en lugar del texto si hay cambios', () => {
    const items = mount(TicketTimeline, { props: { events } }).findAll('li')

    expect(items[1]!.find('.timeline__detail').text()).toBe('Tiempo de resolución 10.25 h')
    expect(items[2]!.find('.timeline__detail').exists()).toBe(false)
    expect(items[2]!.findComponent(ChangeComparison).props('afterClose')).toBe(true)
  })

  it('distingue la edición posterior al cierre y el último evento', () => {
    const items = mount(TicketTimeline, { props: { events } }).findAll('li')

    expect(items[2]!.classes()).toEqual(
      expect.arrayContaining(['timeline__event--after-close', 'timeline__event--last']),
    )
    expect(items[2]!.find('.timeline__badge').text()).toBe('Edición posterior al cierre')
    expect(items[0]!.find('.timeline__badge').exists()).toBe(false)
  })
})

describe('TicketSummary', () => {
  it('resalta las entidades dentro de la descripción', () => {
    const wrapper = mount(TicketSummary, { props: { ticket: ticketById('TCK-200007') } })

    expect(wrapper.findAll('mark').map((mark) => mark.text())).toEqual([
      'Cluster K8s',
      'DEADLOCK_DB',
    ])
    expect(wrapper.find('.summary__text').text()).toBe(ticketById('TCK-200007').description)
  })

  it('lista los datos del ticket y agrega la resolución si existe', () => {
    const open = mount(TicketSummary, { props: { ticket: ticketById('TCK-200007') } })
    const resolved = mount(TicketSummary, { props: { ticket: ticketById('TCK-115796') } })

    expect(open.findAll('dt').map((term) => term.text())).not.toContain('Tiempo de resolución')
    expect(open.find('.summary__row:nth-child(7) dd').text()).toBe('3 h 10 min')
    expect(resolved.find('.summary__row:last-child').text()).toBe('Tiempo de resolución2.00 h')
  })
})

describe('TicketAnalysis', () => {
  it('ordena las probabilidades y destaca la mayor', () => {
    const wrapper = mount(TicketAnalysis, { props: { ticket: ticketById('TCK-115796') } })
    const rows = wrapper.findAll('.analysis__probability')

    expect(rows.map((row) => row.find('span').text())).toEqual(['Alta', 'Crítica', 'Media', 'Baja'])
    expect(rows[0]!.find('.progress__fill').attributes('style')).toContain('var(--color-accent)')
    expect(rows[1]!.find('.progress__fill').attributes('style')).toContain(
      'var(--color-accent-ring)',
    )
  })

  it('muestra confianza, entidades y "Ninguno" sin códigos de error', () => {
    const wrapper = mount(TicketAnalysis, { props: { ticket: ticketById('TCK-115796') } })

    expect(wrapper.text()).toContain('81 % de confianza')
    expect(wrapper.findAll('.analysis__chip').map((chip) => chip.text())).toEqual([
      'Switch de núcleo',
    ])
    expect(wrapper.text()).toContain('Ninguno')
  })

  it('muestra los códigos de error en monoespaciada', () => {
    const wrapper = mount(TicketAnalysis, { props: { ticket: ticketById('TCK-200007') } })

    expect(wrapper.find('.analysis__chip--mono').text()).toBe('DEADLOCK_DB')
  })
})
