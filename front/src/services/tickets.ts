import { tickets } from '@/mocks/tickets'
import type { Page } from '@/types/page'
import { PRIORITIES } from '@/types/ticket'
import type { Ticket, TicketDateFilter, TicketQuery } from '@/types/ticket'
import { minutesSince, now, toDateKey } from '@/utils/clock'

import { mockRequest, paginate } from './mockRequest'

const MINUTES_IN_HOUR = 60
const DATE_LIMITS: Record<Exclude<TicketDateFilter, 'hoy'>, number> = {
  '48': 48 * MINUTES_IN_HOUR,
  '7': 7 * 24 * MINUTES_IN_HOUR,
}

function matchesDate(ticket: Ticket, date?: TicketDateFilter) {
  if (!date) return true
  if (date === 'hoy') return ticket.createdAt.startsWith(toDateKey(now()))
  return minutesSince(ticket.createdAt) <= DATE_LIMITS[date]
}

function matchesSearch(ticket: Ticket, search?: string) {
  const term = search?.trim().toLowerCase()
  if (!term) return true
  return [ticket.id, ticket.summary, ticket.description, ticket.area]
    .join(' ')
    .toLowerCase()
    .includes(term)
}

const byUrgency = (a: Ticket, b: Ticket) =>
  PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) ||
  a.createdAt.localeCompare(b.createdAt)

// Los resueltos solo aparecen al pedirlos, como en la bandeja del prototipo.
export function listTickets(query: TicketQuery = {}): Promise<Page<Ticket>> {
  const { priority, department, status, date, search, page, pageSize } = query

  return mockRequest(() => {
    const items = tickets
      .filter((ticket) => (ticket.status === 'Resuelto') === (status === 'Resuelto'))
      .filter((ticket) => !priority || ticket.priority === priority)
      .filter((ticket) => !department || ticket.department === department)
      .filter((ticket) => !status || ticket.status === status)
      .filter((ticket) => matchesDate(ticket, date))
      .filter((ticket) => matchesSearch(ticket, search))
      .sort(byUrgency)

    return paginate(items, page, pageSize)
  })
}

export function getTicket(id: string): Promise<Ticket | null> {
  return mockRequest(() => tickets.find((ticket) => ticket.id === id) ?? null)
}
