import type { Page } from '@/types/page'
import type {
  DraftAnalysis,
  Priority,
  Resolution,
  Technician,
  Ticket,
  TicketDraft,
  TicketQuery,
} from '@/types/ticket'

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

// Clasifica la captura sin guardarla, para revisarla antes de confirmar.
export function analyzeTicket(draft: TicketDraft): Promise<DraftAnalysis> {
  return request('/api/tickets/analyze', { method: 'POST', body: draft })
}

// El servidor vuelve a clasificar al guardar: no se envía el análisis que se mostró.
export function createTicket(draft: TicketDraft): Promise<Ticket> {
  return request('/api/tickets', { method: 'POST', body: draft })
}

const ticketPath = (id: string, action: string) =>
  `/api/tickets/${encodeURIComponent(id)}/${action}`

// Solo el técnico asignado: pasa un ticket Abierto a En atención.
export function attendTicket(id: string): Promise<Ticket> {
  return request(ticketPath(id, 'attend'), { method: 'POST' })
}

// Solo el técnico asignado, con el ticket En atención.
export function resolveTicket(id: string, resolution: Resolution): Promise<Ticket> {
  return request(ticketPath(id, 'resolve'), { method: 'POST', body: resolution })
}

export function listTechnicians(): Promise<Technician[]> {
  return request('/api/technicians')
}

// Solo el coordinador, mientras el ticket no esté resuelto.
export function assignTicket(id: string, technician: string): Promise<Ticket> {
  return request(ticketPath(id, 'assign'), { method: 'POST', body: { technician } })
}
