import { delay, http, HttpResponse } from 'msw'

import type { Dashboard, DashboardPeriod, Trend } from '@/types/dashboard'
import {
  EVENT_DATE_FILTERS,
  type AuditEvent,
  type EventDateFilter,
  type EventType,
} from '@/types/event'
import type { NewUser, User } from '@/types/user'
import type { Page } from '@/types/page'
import { DEPARTMENTS, PRIORITIES, TICKET_DATE_FILTERS, TICKET_STATUSES } from '@/types/ticket'
import type {
  DraftAnalysis,
  Resolution,
  Ticket,
  TicketDateFilter,
  TicketDraft,
} from '@/types/ticket'
import { minutesSince, now, toDateKey } from '@/utils/clock'

import { backups, tables } from './database'
import { events } from './events'
import { modelMetrics } from './model'
import { tickets, type DemoTicket } from './tickets'
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

// Clasificación simulada: reglas sencillas sobre el texto. La real la hace el modelo en la API.
const SIMULATED_DEVICES = ['Cluster K8s', 'Servidor Ubuntu', 'Storage SAN', 'Impresora de Red']
const ERROR_CODE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g

export function simulateAnalysis(draft: TicketDraft): DraftAnalysis {
  const critical = /caída|fuera de servicio|deadlock|detiene/i.test(draft.description)
  const devices = SIMULATED_DEVICES.filter((device) =>
    draft.description.toLowerCase().includes(device.toLowerCase()),
  )
  const errorCodes = [...new Set(draft.description.match(ERROR_CODE) ?? [])]
  const typed = draft.device?.trim()
  return {
    priority: critical ? 'Crítica' : 'Media',
    department: critical ? 'Infraestructura Cloud' : 'Soporte de Aplicaciones',
    device: typed || devices[0] || 'Sin Especificar',
    deviceDetected: !typed && devices.length > 0,
    highlights: [...devices, ...errorCodes],
    analysis: {
      confidence: critical ? 88 : 64,
      probabilities: critical
        ? { Crítica: 88, Alta: 9, Media: 2, Baja: 1 }
        : { Crítica: 4, Alta: 20, Media: 64, Baja: 12 },
      sentiment: critical ? 'Negativo' : 'Neutral',
      intent: 'Reporte de incidente',
      keywords:
        draft.description
          .toLowerCase()
          .match(/[a-záéíóúñ]{6,}/g)
          ?.slice(0, 6) ?? [],
      devices,
      errorCodes,
    },
  }
}

function draftErrors(draft: TicketDraft) {
  const errors = []
  if (!draft.reporter?.trim())
    errors.push({ field: 'reporter', message: 'Este campo es obligatorio.' })
  const length = draft.description?.trim().length ?? 0
  if (length < 20) {
    errors.push({ field: 'description', message: 'Debe tener al menos 20 caracteres.' })
  }
  return errors
}

const FIRST_NEW_TICKET = 200030
let nextTicketNumber = FIRST_NEW_TICKET

const originalTickets = structuredClone(tickets)
const originalUsers = structuredClone(users)
// Contraseñas cambiadas o de usuarios nuevos; las demás son MOCK_PASSWORD.
const passwords: Record<string, string> = {}

// Restaura la demo (quita registros, resoluciones y reasignaciones) para que cada prueba
// empiece con los mismos datos.
export function resetMockData() {
  tickets.splice(0, tickets.length, ...structuredClone(originalTickets))
  users.splice(0, users.length, ...structuredClone(originalUsers))
  for (const username of Object.keys(passwords)) delete passwords[username]
  nextTicketNumber = FIRST_NEW_TICKET
}

async function respond<T>(body: () => T) {
  if (failing) return HttpResponse.error()
  await delay(LATENCY_MS)
  return HttpResponse.json(body() as never)
}

const usernameOf = (name?: string) => users.find((user) => user.name === name)?.username

// Los tickets de la demo guardan el nombre del técnico; la API también envía su usuario.
const withUsername = (ticket: Ticket): Ticket => ({
  ...ticket,
  technicianUsername: usernameOf(ticket.technician),
  resolvedByUsername: usernameOf(ticket.resolvedBy),
})

const sessionUser = (request: Request) => {
  const username = request.headers.get('authorization')?.replace('Bearer simulado-', '')
  return users.find((user) => user.username === username)
}

const problem = (status: number, detail: string) => HttpResponse.json({ detail }, { status })

// Mismas reglas que la API para atender y resolver.
async function changeTicket(
  request: Request,
  id: string,
  change: (ticket: DemoTicket, name: string) => Response | void,
) {
  if (failing) return HttpResponse.error()
  await delay(LATENCY_MS)
  const ticket = tickets.find((candidate) => candidate.id === id)
  if (!ticket) return problem(404, 'Ticket no encontrado.')
  const user = sessionUser(request)
  if (!user || usernameOf(ticket.technician) !== user.username) {
    return problem(
      403,
      `Solo el técnico asignado puede atender este ticket. Está asignado a ${ticket.technician}.`,
    )
  }
  return change(ticket, user.name) ?? HttpResponse.json(withUsername(ticket))
}

const SIMULATED_TRENDS: Record<DashboardPeriod, Omit<Trend, 'period'>> = {
  semana: {
    subtitle: 'Última semana, por día',
    labels: ['Jue 22', 'Vie 23', 'Sáb 24', 'Dom 25', 'Lun 26', 'Mar 27', 'Mié 28'],
    created: [9, 8, 3, 2, 11, 10, 7],
    resolved: [8, 9, 4, 2, 9, 10, 6],
  },
  mes: {
    subtitle: 'Último mes, por semana',
    labels: ['S40', 'S41', 'S42', 'S43', 'S44'],
    created: [47, 43, 50, 46, 41],
    resolved: [44, 45, 47, 44, 39],
  },
  año: {
    subtitle: 'Último año, por mes',
    labels: ['Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct'],
    created: [172, 158, 181, 176, 190, 185, 179, 194, 201, 188, 196, 203],
    resolved: [168, 160, 175, 174, 186, 183, 181, 189, 197, 190, 192, 198],
  },
}

function simulatedDashboard(period: DashboardPeriod): Dashboard {
  const open = tickets.filter((ticket) => ticket.status !== 'Resuelto')
  const countBy = (labels: readonly string[], pick: (ticket: Ticket) => string) =>
    labels.map((label) => ({
      label,
      count: tickets.filter((ticket) => pick(ticket) === label).length,
    }))
  return {
    kpis: {
      openTickets: open.length,
      openTicketsBefore: open.length - 5,
      criticalOpen: open.filter((ticket) => ticket.priority === 'Crítica').length,
      criticalOpenBefore: 3,
      averageResolutionHours: 25.6,
      averageResolutionHoursBefore: 27.4,
      slaCompliance: 91.8,
      slaComplianceBefore: 91.2,
    },
    byPriority: countBy(PRIORITIES, (ticket) => ticket.priority),
    total: tickets.length,
    byDepartment: countBy(DEPARTMENTS, (ticket) => ticket.department).sort(
      (a, b) => b.count - a.count,
    ),
    trend: { period, ...SIMULATED_TRENDS[period] },
    resolutionVsSla: [
      { priority: 'Crítica', averageHours: 5, slaHours: 4 },
      { priority: 'Alta', averageHours: 8.8, slaHours: 12 },
      { priority: 'Media', averageHours: 30.1, slaHours: 48 },
      { priority: 'Baja', averageHours: 58.3, slaHours: 96 },
    ],
    critical: open
      .filter((ticket) => ticket.priority === 'Crítica')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(withUsername),
  }
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
    if (!user?.active || password !== (passwords[user.username] ?? MOCK_PASSWORD)) {
      return HttpResponse.json({ detail: 'Usuario o contraseña incorrectos.' }, { status: 401 })
    }
    return HttpResponse.json({ token: `simulado-${user.username}`, user })
  }),

  http.post('*/api/auth/password', async ({ request }) => {
    if (failing) return HttpResponse.error()
    await delay(LATENCY_MS)
    const user = sessionUser(request)
    const { currentPassword, newPassword } = (await request.json()) as Record<string, string>
    if (!user) return problem(401, 'Tu sesión terminó.')
    const fieldProblem = (field: string, message: string) =>
      HttpResponse.json(
        { detail: 'Revisa los datos enviados.', errors: [{ field, message }] },
        { status: 422 },
      )
    if (currentPassword !== (passwords[user.username] ?? MOCK_PASSWORD)) {
      return fieldProblem('currentPassword', 'La contraseña actual no es correcta.')
    }
    if (newPassword === currentPassword) {
      return fieldProblem('newPassword', 'Debe ser distinta de la actual.')
    }
    passwords[user.username] = newPassword ?? ''
    user.mustChangePassword = false
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

  http.post('*/api/tickets/analyze', async ({ request }) => {
    if (failing) return HttpResponse.error()
    await delay(LATENCY_MS)
    const draft = (await request.json()) as TicketDraft
    const errors = draftErrors(draft)
    if (errors.length) {
      return HttpResponse.json({ detail: 'Revisa los datos enviados.', errors }, { status: 422 })
    }
    return HttpResponse.json(simulateAnalysis(draft))
  }),

  http.post('*/api/tickets', async ({ request }) => {
    if (failing) return HttpResponse.error()
    await delay(LATENCY_MS)
    const draft = (await request.json()) as TicketDraft
    const result = simulateAnalysis(draft)
    const ticket = {
      id: `TCK-${nextTicketNumber++}`,
      priority: result.priority,
      area: draft.area,
      device: result.device,
      department: result.department,
      status: 'Abierto',
      createdAt: '2026-10-28 11:42',
      reporter: draft.reporter.trim(),
      technician: 'Roberto García Hernández',
      summary: draft.description.slice(0, 60),
      description: draft.description.trim(),
      highlights: result.highlights,
      analysis: result.analysis,
    } satisfies Ticket
    tickets.push(ticket)
    return HttpResponse.json(ticket, { status: 201 })
  }),

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

      return paginate(
        items.map(withUsername),
        numberParam(params, 'page'),
        numberParam(params, 'pageSize'),
      )
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

  http.post('*/api/tickets/:id/attend', ({ request, params }) =>
    changeTicket(request, String(params.id), (ticket) => {
      if (ticket.status !== 'Abierto') {
        return problem(409, `El ticket ya está ${ticket.status.toLowerCase()}.`)
      }
      ticket.status = 'En atención'
    }),
  ),

  http.post('*/api/tickets/:id/resolve', async ({ request, params }) => {
    const body = (await request.clone().json()) as Resolution
    return changeTicket(request, String(params.id), (ticket, name) => {
      if (ticket.status === 'Resuelto') return problem(409, 'El ticket ya está resuelto.')
      if (ticket.status !== 'En atención') {
        return problem(409, 'Atiende el ticket antes de resolverlo.')
      }
      Object.assign(ticket, {
        status: 'Resuelto',
        solution: body.solution,
        resolutionHours: body.resolutionHours,
        resolvedAt: '2026-10-28 11:42:10',
        resolvedBy: name,
      })
    })
  }),

  http.patch('*/api/tickets/:id/resolution', async ({ request, params }) => {
    if (failing) return HttpResponse.error()
    await delay(LATENCY_MS)
    const body = (await request.json()) as Partial<Resolution>
    const ticket = tickets.find((candidate) => candidate.id === params.id)
    if (!ticket) return problem(404, 'Ticket no encontrado.')
    if (ticket.status !== 'Resuelto') {
      return problem(409, 'Solo se puede corregir la resolución de un ticket resuelto.')
    }
    if (usernameOf(ticket.resolvedBy) !== sessionUser(request)?.username) {
      return problem(403, 'Solo quien resolvió el ticket puede corregir su resolución.')
    }
    const changed =
      (body.solution !== undefined && body.solution !== ticket.solution) ||
      (body.resolutionHours !== undefined && body.resolutionHours !== ticket.resolutionHours)
    if (!changed) return problem(422, 'No hay cambios que guardar.')
    Object.assign(ticket, body, { editedAfterClose: true })
    return HttpResponse.json(withUsername(ticket))
  }),

  http.get('*/api/technicians', () =>
    respond(() =>
      users
        .filter((user) => user.role === 'tecnico' && user.active)
        .map((user) => ({
          username: user.username,
          name: user.name,
          openTickets: tickets.filter(
            (ticket) => ticket.technician === user.name && ticket.status !== 'Resuelto',
          ).length,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ),
  ),

  http.post('*/api/tickets/:id/assign', async ({ request, params }) => {
    if (failing) return HttpResponse.error()
    await delay(LATENCY_MS)
    const { technician } = (await request.json()) as { technician: string }
    const ticket = tickets.find((candidate) => candidate.id === params.id)
    const target = users.find((user) => user.username === technician && user.role === 'tecnico')
    if (!ticket) return problem(404, 'Ticket no encontrado.')
    if (ticket.status === 'Resuelto') {
      return problem(409, 'Un ticket resuelto ya no se puede reasignar.')
    }
    if (!target?.active) return problem(422, 'Elige un técnico activo.')
    if (target.name === ticket.technician) {
      return problem(409, 'El ticket ya está asignado a ese técnico.')
    }
    ticket.technician = target.name
    return HttpResponse.json(withUsername(ticket))
  }),

  http.get('*/api/tickets/:id', async ({ params }) => {
    const ticket = tickets.find((candidate) => candidate.id === params.id)
    if (failing || ticket) return respond(() => ticket && withUsername(ticket))
    await delay(LATENCY_MS)
    return HttpResponse.json({ detail: 'Ticket no encontrado.' }, { status: 404 })
  }),

  // Igual que la API: el historial de un ticket que no existe responde 404.
  http.get('*/api/tickets/:id/events', async ({ params }) => {
    if (!failing && !tickets.some((ticket) => ticket.id === params.id)) {
      await delay(LATENCY_MS)
      return HttpResponse.json({ detail: 'Ticket no encontrado.' }, { status: 404 })
    }
    return respond(() =>
      events
        .filter((event) => event.ticketId === params.id)
        .sort((a, b) => a.time.localeCompare(b.time)),
    )
  }),

  http.get('*/api/events', ({ request }) => {
    const params = new URL(request.url).searchParams
    const type = params.get('type') as EventType | null
    const user = params.get('user')
    const date = pick(params.get('date'), EVENT_DATE_FILTERS)
    const ticketId = params.get('ticketId')?.trim().toUpperCase()
    const afterClose = params.get('afterClose') === 'true'

    return respond(() => {
      const items = events
        .filter((event) => !type || event.type === type)
        .filter((event) => !user || event.user === user)
        .filter((event) => matchesEventDate(event, date))
        // Como la API: el ID se busca exacto (B-13).
        .filter((event) => !ticketId || event.ticketId === ticketId)
        .filter((event) => !afterClose || event.afterClose)
        .sort((a, b) => b.time.localeCompare(a.time))

      return {
        ...paginate(
          items,
          numberParam(params, 'page'),
          numberParam(params, 'pageSize') ?? EVENTS_PER_PAGE,
        ),
        afterCloseTotal: events.filter((event) => event.afterClose).length,
        users: [...new Set(events.map((event) => event.user))].sort(),
      }
    })
  }),

  // Con datos simulados la tendencia es la del prototipo; el resto sale de los tickets de la demo.
  http.get('*/api/dashboard', ({ request }) => {
    const period = (new URL(request.url).searchParams.get('period') ?? 'mes') as DashboardPeriod
    return respond(() => simulatedDashboard(period))
  }),

  http.get('*/api/model/metrics', () => respond(() => modelMetrics)),

  http.get('*/api/users', () => respond(() => users)),

  http.post('*/api/users', async ({ request }) => {
    if (failing) return HttpResponse.error()
    await delay(LATENCY_MS)
    const body = (await request.json()) as NewUser
    if (users.some((user) => user.username === body.username)) {
      return HttpResponse.json(
        {
          detail: 'Revisa los datos enviados.',
          errors: [{ field: 'username', message: 'Ese usuario ya existe.' }],
        },
        { status: 422 },
      )
    }
    const user: User = {
      name: body.name.trim(),
      username: body.username,
      role: body.role,
      active: true,
      mustChangePassword: true,
    }
    users.push(user)
    passwords[user.username] = body.password
    return HttpResponse.json(user, { status: 201 })
  }),

  http.patch('*/api/users/:username', async ({ request, params }) => {
    if (failing) return HttpResponse.error()
    await delay(LATENCY_MS)
    const { active } = (await request.json()) as { active: boolean }
    const user = users.find((candidate) => candidate.username === params.username)
    if (!user) return problem(404, 'Usuario no encontrado.')
    if (!active && sessionUser(request)?.username === user.username) {
      return problem(409, 'No puedes desactivar tu propia cuenta.')
    }
    user.active = active
    return HttpResponse.json(user)
  }),
  http.get('*/api/database/tables', () => respond(() => tables)),
  http.get('*/api/database/backups', () => respond(() => backups)),
]
