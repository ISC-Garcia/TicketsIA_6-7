import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

import { setMockFailure } from '@/mocks/handlers'
import type { AuditEvent } from '@/types/event'

import EventPanel from '../EventPanel.vue'

let mounted: VueWrapper | undefined

afterEach(() => {
  setMockFailure(false)
  mounted?.unmount()
  mounted = undefined
})

async function mountPanel(event: AuditEvent) {
  mounted = mount(EventPanel, { props: { event }, attachTo: document.body })
  await flushPromises()
  return mounted
}

const rows = (wrapper: VueWrapper) =>
  Object.fromEntries(
    wrapper.findAll('.event__row').map((row) => [row.find('dt').text(), row.find('dd').text()]),
  )

describe('EventPanel', () => {
  it('E8-02: explica el tiempo de resolución y la solución aplicada', async () => {
    const wrapper = await mountPanel({
      id: 'EV-1',
      time: '2025-12-09 04:12:45',
      user: 'Sarely Xala Hernández',
      type: 'Ticket resuelto',
      ticketId: 'TCK-115796',
      detail: '10.25 h',
      solution: 'Se reinició el servicio de impresión.',
    })

    expect(rows(wrapper)).toEqual({
      'Fecha y hora': '2025-12-09 04:12:45',
      Usuario: 'Sarely Xala Hernández',
      'Tipo de evento': 'Ticket resuelto',
      Ticket: 'TCK-115796',
      Detalle: 'Tiempo de resolución 10.25 h',
      'Solución aplicada': 'Se reinició el servicio de impresión.',
    })
    expect(wrapper.find('.event__after-close').exists()).toBe(false)
  })

  it('E8-02: sin el ticket, la edición posterior al cierre se avisa sin fecha', async () => {
    setMockFailure(true)
    const wrapper = await mountPanel({
      id: 'EV-2',
      time: '2026-10-27 18:40:22',
      user: 'Francisco Alejandro Parra Huerta',
      type: 'Edición de datos',
      ticketId: 'TCK-115796',
      afterClose: true,
      changes: [{ field: 'Tiempo de resolución', oldValue: '10.25 h', newValue: '2.00 h' }],
    })

    expect(wrapper.find('.event__after-close').text()).toBe(
      'Edición posterior al cierre del ticket.',
    )
  })

  it('E8-02: avisa a quien lo usa para abrir el historial', async () => {
    const wrapper = await mountPanel({
      id: 'EV-3',
      time: '2026-10-28 09:57:04',
      user: 'Roberto García Hernández',
      type: 'Ticket creado',
      ticketId: 'TCK-200003',
    })

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Ver historial del ticket')!
      .trigger('click')

    expect(wrapper.emitted('history')).toEqual([['TCK-200003']])
  })
})
