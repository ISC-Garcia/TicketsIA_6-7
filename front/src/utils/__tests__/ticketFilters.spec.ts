import { describe, expect, it } from 'vitest'

import { hasTicketFilters, parseTicketFilters, ticketFiltersToQuery } from '../ticketFilters'

describe('parseTicketFilters', () => {
  it('lee los filtros de la URL', () => {
    expect(
      parseTicketFilters({
        prioridad: 'Crítica',
        departamento: 'Redes y Conectividad',
        estado: 'Abierto',
        fecha: '7',
        q: 'vpn',
      }),
    ).toEqual({
      priority: 'Crítica',
      department: 'Redes y Conectividad',
      status: 'Abierto',
      date: '7',
      search: 'vpn',
    })
  })

  it('ignora valores desconocidos, vacíos o repetidos', () => {
    expect(
      parseTicketFilters({
        prioridad: 'Urgente',
        estado: ['Abierto', 'Resuelto'],
        q: '',
        fecha: '30',
      }),
    ).toEqual({
      priority: undefined,
      department: undefined,
      status: undefined,
      date: undefined,
      search: undefined,
    })
  })
})

describe('ticketFiltersToQuery', () => {
  it('omite los filtros vacíos', () => {
    expect(ticketFiltersToQuery({ priority: 'Alta', search: '' })).toEqual({
      prioridad: 'Alta',
      departamento: undefined,
      estado: undefined,
      fecha: undefined,
      q: undefined,
    })
  })

  it('ida y vuelta conserva los filtros', () => {
    const filters = {
      priority: 'Media',
      status: 'En atención',
      date: 'hoy',
      search: 'red',
    } as const

    expect(
      parseTicketFilters(ticketFiltersToQuery(filters) as Record<string, string>),
    ).toMatchObject(filters)
  })
})

describe('hasTicketFilters', () => {
  it('detecta si hay algún filtro activo', () => {
    expect(hasTicketFilters({})).toBe(false)
    expect(hasTicketFilters({ search: undefined })).toBe(false)
    expect(hasTicketFilters({ date: '48' })).toBe(true)
  })
})
