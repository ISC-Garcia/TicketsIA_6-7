import type { Page } from './page'

export const EVENT_TYPES = [
  'Ticket creado',
  'Clasificado por IA',
  'Cambio de estado',
  'Ticket resuelto',
  'Reasignación',
  'Edición de datos',
  'Inicio de sesión',
  'Cierre de sesión',
  'Cambio de contraseña',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export interface FieldChange {
  field: string
  oldValue: string
  newValue: string
}

export interface AuditEvent {
  id: string
  time: string
  user: string
  type: EventType
  ticketId?: string
  detail?: string
  changes?: FieldChange[]
  afterClose?: boolean
  solution?: string
}

export const EVENT_DATE_FILTERS = ['hoy', '7'] as const
export type EventDateFilter = (typeof EVENT_DATE_FILTERS)[number]

export interface EventQuery {
  type?: EventType
  user?: string
  date?: EventDateFilter
  ticketId?: string
  afterClose?: boolean
  page?: number
  pageSize?: number
}

// La página trae también lo que no depende de los filtros: el conteo de ediciones
// posteriores al cierre y los usuarios que aparecen en la bitácora.
export interface EventPage extends Page<AuditEvent> {
  afterCloseTotal: number
  users: string[]
}
