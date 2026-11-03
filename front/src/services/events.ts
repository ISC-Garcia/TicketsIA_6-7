import type { AuditEvent, EventQuery } from '@/types/event'
import type { Page } from '@/types/page'

import { request } from './http'

export function listEvents(query: EventQuery = {}): Promise<Page<AuditEvent>> {
  return request('/api/events', { query: { ...query } })
}

export function listTicketEvents(ticketId: string): Promise<AuditEvent[]> {
  return request(`/api/tickets/${encodeURIComponent(ticketId)}/events`)
}
