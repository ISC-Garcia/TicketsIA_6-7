import { events } from '@/mocks/events'
import type { AuditEvent, EventDateFilter, EventQuery } from '@/types/event'
import type { Page } from '@/types/page'
import { now, toDateKey } from '@/utils/clock'

import { mockRequest, paginate } from './mockRequest'

const EVENTS_PER_PAGE = 10
const WEEK_DAYS_BACK = 6

function matchesDate(event: AuditEvent, date?: EventDateFilter) {
  if (!date) return true

  const today = now()
  if (date === 'hoy') return event.time.startsWith(toDateKey(today))

  today.setDate(today.getDate() - WEEK_DAYS_BACK)
  return event.time >= toDateKey(today)
}

export function listEvents(query: EventQuery = {}): Promise<Page<AuditEvent>> {
  const { type, user, date, afterClose, page, pageSize = EVENTS_PER_PAGE } = query
  const ticketId = query.ticketId?.trim().toUpperCase()

  return mockRequest(() => {
    const items = events
      .filter((event) => !type || event.type === type)
      .filter((event) => !user || event.user === user)
      .filter((event) => matchesDate(event, date))
      .filter((event) => !ticketId || event.ticketId?.includes(ticketId))
      .filter((event) => !afterClose || event.afterClose)
      .sort((a, b) => b.time.localeCompare(a.time))

    return paginate(items, page, pageSize)
  })
}

export function listTicketEvents(ticketId: string): Promise<AuditEvent[]> {
  return mockRequest(() =>
    events
      .filter((event) => event.ticketId === ticketId)
      .sort((a, b) => a.time.localeCompare(b.time)),
  )
}
