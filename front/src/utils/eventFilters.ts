import type { LocationQuery, LocationQueryRaw } from 'vue-router'

import { EVENT_DATE_FILTERS, EVENT_TYPES } from '@/types/event'
import type { EventQuery } from '@/types/event'

export type EventFilters = Pick<
  EventQuery,
  'type' | 'user' | 'date' | 'ticketId' | 'afterClose' | 'page'
>

const parsePage = (value: unknown) => {
  const page = Number(value)
  return Number.isInteger(page) && page > 1 ? page : undefined
}

const pick = <T extends string>(value: unknown, allowed: readonly T[]) =>
  allowed.find((option) => option === value)

const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined)

// Como en la bandeja, los filtros viven en la URL: se conservan al ir al historial y volver.
export function parseEventFilters(query: LocationQuery): EventFilters {
  return {
    type: pick(query.tipo, EVENT_TYPES),
    user: text(query.usuario),
    date: pick(query.fecha, EVENT_DATE_FILTERS),
    ticketId: text(query.ticket),
    afterClose: query.posteriores === '1' || undefined,
    page: parsePage(query.pagina),
  }
}

export function eventFiltersToQuery(filters: EventFilters): LocationQueryRaw {
  return {
    tipo: filters.type,
    usuario: filters.user,
    fecha: filters.date,
    ticket: filters.ticketId || undefined,
    posteriores: filters.afterClose ? '1' : undefined,
    pagina: filters.page && filters.page > 1 ? filters.page : undefined,
  }
}

export const hasEventFilters = ({ page: _page, ...filters }: EventFilters) =>
  Object.values(filters).some(Boolean)
