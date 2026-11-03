import type { LocationQuery, LocationQueryRaw } from 'vue-router'

import { DEPARTMENTS, PRIORITIES, TICKET_DATE_FILTERS, TICKET_STATUSES } from '@/types/ticket'
import type { TicketQuery } from '@/types/ticket'

export type TicketFilters = Pick<
  TicketQuery,
  'priority' | 'department' | 'status' | 'date' | 'search'
>

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
  }
}

export function ticketFiltersToQuery(filters: TicketFilters): LocationQueryRaw {
  return {
    prioridad: filters.priority,
    departamento: filters.department,
    estado: filters.status,
    fecha: filters.date,
    q: filters.search || undefined,
  }
}

export const hasTicketFilters = (filters: TicketFilters) => Object.values(filters).some(Boolean)
