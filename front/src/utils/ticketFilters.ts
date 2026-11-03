import type { LocationQuery, LocationQueryRaw } from 'vue-router'

import { DEPARTMENTS, PRIORITIES, TICKET_DATE_FILTERS, TICKET_STATUSES } from '@/types/ticket'
import type { TicketQuery } from '@/types/ticket'

export type TicketFilters = Pick<
  TicketQuery,
  'priority' | 'department' | 'status' | 'date' | 'search' | 'page'
>

const parsePage = (value: unknown) => {
  const page = Number(value)
  return Number.isInteger(page) && page > 1 ? page : undefined
}

const pick = <T extends string>(value: unknown, allowed: readonly T[]) =>
  allowed.find((option) => option === value)

// Los filtros viven en la URL para conservarse al abrir un ticket y volver.
// Un valor desconocido se ignora en lugar de romper la bandeja.
export function parseTicketFilters(query: LocationQuery): TicketFilters {
  return {
    priority: pick(query.prioridad, PRIORITIES),
    department: pick(query.departamento, DEPARTMENTS),
    status: pick(query.estado, TICKET_STATUSES),
    date: pick(query.fecha, TICKET_DATE_FILTERS),
    search: typeof query.q === 'string' && query.q ? query.q : undefined,
    page: parsePage(query.pagina),
  }
}

export function ticketFiltersToQuery(filters: TicketFilters): LocationQueryRaw {
  return {
    prioridad: filters.priority,
    departamento: filters.department,
    estado: filters.status,
    fecha: filters.date,
    q: filters.search || undefined,
    pagina: filters.page && filters.page > 1 ? filters.page : undefined,
  }
}

// La página no cuenta como filtro: no muestra "Limpiar filtros".
export const hasTicketFilters = ({ page: _page, ...filters }: TicketFilters) =>
  Object.values(filters).some(Boolean)
