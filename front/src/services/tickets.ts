import type { Page } from '@/types/page'
import type { Priority, Ticket, TicketQuery } from '@/types/ticket'

import { request, ServiceError } from './http'

const NOT_FOUND = 404

// Los resueltos solo aparecen al filtrar por Estado = Resuelto.
export function listTickets(query: TicketQuery = {}): Promise<Page<Ticket>> {
  return request('/api/tickets', { query: { ...query } })
}

// Los conteos de las pestañas de prioridad ignoran los demás filtros.
export function countTicketsByPriority(resolved = false): Promise<Record<Priority, number>> {
  return request('/api/tickets/counts', { query: { resolved } })
}

export async function getTicket(id: string): Promise<Ticket | null> {
  try {
    return await request<Ticket>(`/api/tickets/${encodeURIComponent(id)}`)
  } catch (error) {
    if (error instanceof ServiceError && error.status === NOT_FOUND) return null
    throw error
  }
}
