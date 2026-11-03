import { delay, http, HttpResponse } from 'msw'

import type { AuditEvent, EventDateFilter, EventType } from '@/types/event'
import type { Page } from '@/types/page'
import { DEPARTMENTS, PRIORITIES, TICKET_DATE_FILTERS, TICKET_STATUSES } from '@/types/ticket'
import type { Ticket, TicketDateFilter } from '@/types/ticket'
import { minutesSince, now, toDateKey } from '@/utils/clock'

import { backups, tables } from './database'
import { events } from './events'
import { tickets } from './tickets'
import { users } from './users'

// Imita a la API: mismas rutas, mismos parámetros y mismas respuestas. Lo usan las pruebas
// unitarias y, con VITE_API_MOCK=true, el front cuando no hay back.

export const MOCK_PASSWORD = 'demo2026'
const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 300
const EVENTS_PER_PAGE = 10
const WEEK_DAYS_BACK = 6
const MINUTES_IN_HOUR = 60
const DATE_LIMITS: Record<Exclude<TicketDateFilter, 'hoy'>, number> = {
  '48': 48 * MINUTES_IN_HOUR,
  '7': 7 * 24 * MINUTES_IN_HOUR,
}

let failing = import.meta.env.VITE_MOCK_FAILURE === 'true'

// Simula que el servidor no responde, para probar los estados de error.
export const setMockFailure = (value: boolean) => {
  failing = value
}

export function paginate<T>(items: T[], page = 1, pageSize = items.length): Page<T> {
  const start = (page - 1) * pageSize

  return { items: items.slice(start, start + pageSize), total: items.length }
}

const pick = <T extends string>(value: string | null, allowed: readonly T[]) =>
  allowed.find((option) => option === value)

const numberParam = (params: URLSearchParams, key: string) => {
  const value = params.get(key)
  return value ? Number(value) : undefined
}

function matchesTicketDate(ticket: Ticket, date?: TicketDateFilter) {
  if (!date) return true
  if (date === 'hoy') return ticket.createdAt.startsWith(toDateKey(now()))
  return minutesSince(ticket.createdAt) <= DATE_LIMITS[date]
}

function matchesSearch(ticket: Ticket, search: string | null) {
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

function matchesEventDate(event: AuditEvent, date?: EventDateFilter) {
  if (!date) return true

  const today = now()
  if (date === 'hoy') return event.time.startsWith(toDateKey(today))

  today.setDate(today.getDate() - WEEK_DAYS_BACK)
  return event.time >= toDateKey(today)
}

async function respond<T>(body: () => T) {
  if (failing) return HttpResponse.error()
  await delay(LATENCY_MS)
  return HttpResponse.json(body() as never)
}

export const handlers = [
  http.post('*/api/auth/login', async ({ request }) => {
    if (failing) return HttpResponse.error()
    await delay(LATENCY_MS)

    const { username, password } = (await request.json()) as Record<string, string>
    const user = users.find(
      (candidate) => candidate.username === (username ?? '').trim().toLowerCase(),
    )
    // Una cuenta desactivada recibe el mismo error para no revelar qué usuarios existen.
    if (!user?.active || password !== MOCK_PASSWORD) {
      return HttpResponse.json({ detail: 'Usuario o contraseña incorrectos.' }, { status: 401 })
    }
    return HttpResponse.json({ token: `simulado-${user.username}`, user })
  }),

  http.get('*/api/auth/me', ({ request }) => {
    if (failing) return HttpResponse.error()
    const token = request.headers.get('authorization')?.replace('Bearer simulado-', '')
    const user = users.find((candidate) => candidate.username === token && candidate.active)
    if (!user) {
      return HttpResponse.json({ detail: 'Tu sesión terminó.' }, { status: 401 })
    }
    return HttpResponse.json(user)
  }),

  http.post('*/api/auth/logout', () =>
    failing ? HttpResponse.error() : new HttpResponse(null, { status: 204 }),
  ),

  // Los resueltos solo aparecen al pedirlos, como en la bandeja del prototipo.
  http.get('*/api/tickets', ({ request }) => {
    const params = new URL(request.url).searchParams
    const priority = pick(params.get('priority'), PRIORITIES)
    const department = pick(params.get('department'), DEPARTMENTS)
    const status = pick(params.get('status'), TICKET_STATUSES)
    const date = pick(params.get('date'), TICKET_DATE_FILTERS)
    const search = params.get('search')

    return respond(() => {
      const items = tickets
        .filter((ticket) => (ticket.status === 'Resuelto') === (status === 'Resuelto'))
        .filter((ticket) => !priority || ticket.priority === priority)
        .filter((ticket) => !department || ticket.department === department)
        .filter((ticket) => !status || ticket.status === status)
        .filter((ticket) => matchesTicketDate(ticket, date))
        .filter((ticket) => matchesSearch(ticket, search))
        .sort(byUrgency)

      return paginate(items, numberParam(params, 'page'), numberParam(params, 'pageSize'))
    })
  }),

  // Los conteos de las pestañas de prioridad ignoran los demás filtros, como en el prototipo.
  http.get('*/api/tickets/counts', ({ request }) => {
    const resolved = new URL(request.url).searchParams.get('resolved') === 'true'

    return respond(() => {
      const counts = Object.fromEntries(PRIORITIES.map((priority) => [priority, 0]))
      for (const ticket of tickets) {
        if ((ticket.status === 'Resuelto') === resolved) counts[ticket.priority]! += 1
      }
      return counts
    })
  }),

  http.get('*/api/tickets/:id', async ({ params }) => {
    const ticket = tickets.find((candidate) => candidate.id === params.id)
    if (failing || ticket) return respond(() => ticket)
    await delay(LATENCY_MS)
    return HttpResponse.json({ detail: 'Ticket no encontrado.' }, { status: 404 })
  }),

  http.get('*/api/tickets/:id/events', ({ params }) =>
    respond(() =>
      events
        .filter((event) => event.ticketId === params.id)
        .sort((a, b) => a.time.localeCompare(b.time)),
    ),
  ),

  http.get('*/api/events', ({ request }) => {
    const params = new URL(request.url).searchParams
    const type = params.get('type') as EventType | null
    const user = params.get('user')
    const date = pick(params.get('date'), ['hoy', '7'] as const)
    const ticketId = params.get('ticketId')?.trim().toUpperCase()
    const afterClose = params.get('afterClose') === 'true'

    return respond(() => {
      const items = events
        .filter((event) => !type || event.type === type)
        .filter((event) => !user || event.user === user)
        .filter((event) => matchesEventDate(event, date))
        .filter((event) => !ticketId || event.ticketId?.includes(ticketId))
        .filter((event) => !afterClose || event.afterClose)
        .sort((a, b) => b.time.localeCompare(a.time))

      return paginate(
        items,
        numberParam(params, 'page'),
        numberParam(params, 'pageSize') ?? EVENTS_PER_PAGE,
      )
    })
  }),

  http.get('*/api/users', () => respond(() => users)),
  http.get('*/api/database/tables', () => respond(() => tables)),
  http.get('*/api/database/backups', () => respond(() => backups)),
]
