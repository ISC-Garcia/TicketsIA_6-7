import type { AuditEvent, EventPage, EventQuery } from '@/types/event'

import { request } from './http'

export function listEvents(query: EventQuery = {}): Promise<EventPage> {
  return request('/api/events', { query: { ...query } })
}

export function listTicketEvents(ticketId: string): Promise<AuditEvent[]> {
  return request(`/api/tickets/${encodeURIComponent(ticketId)}/events`)
}
