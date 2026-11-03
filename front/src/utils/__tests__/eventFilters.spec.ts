import { describe, expect, it } from 'vitest'

import { eventFiltersToQuery, hasEventFilters, parseEventFilters } from '../eventFilters'

describe('parseEventFilters', () => {
  it('lee los filtros de la URL', () => {
    expect(
      parseEventFilters({
        tipo: 'Edición de datos',
        usuario: 'Sistema',
        fecha: 'hoy',
        ticket: 'TCK-115796',
        posteriores: '1',
        pagina: '3',
      }),
    ).toEqual({
      type: 'Edición de datos',
      user: 'Sistema',
      date: 'hoy',
      ticketId: 'TCK-115796',
      afterClose: true,
      page: 3,
    })
  })

  it('ignora valores desconocidos, vacíos o repetidos', () => {
    expect(
      parseEventFilters({
        tipo: 'Otro',
        usuario: ['Sistema', 'X'],
        fecha: '48',
        ticket: '',
        posteriores: 'si',
        pagina: '1',
      }),
    ).toEqual({
      type: undefined,
      user: undefined,
      date: undefined,
      ticketId: undefined,
      afterClose: undefined,
      page: undefined,
    })
  })
})

describe('eventFiltersToQuery', () => {
  it('omite los filtros vacíos y la primera página', () => {
    expect(eventFiltersToQuery({ afterClose: true, ticketId: '', page: 1 })).toEqual({
      tipo: undefined,
      usuario: undefined,
      fecha: undefined,
      ticket: undefined,
      posteriores: '1',
      pagina: undefined,
    })
    expect(eventFiltersToQuery({ page: 2 }).pagina).toBe(2)
  })
})

describe('hasEventFilters', () => {
  it('no cuenta la página como filtro', () => {
    expect(hasEventFilters({ page: 2 })).toBe(false)
    expect(hasEventFilters({ afterClose: true })).toBe(true)
  })
})
