export const PRIORITIES = ['Crítica', 'Alta', 'Media', 'Baja'] as const
export type Priority = (typeof PRIORITIES)[number]

export const TICKET_STATUSES = ['Abierto', 'En atención', 'Resuelto'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const DEPARTMENTS = [
  'Infraestructura Cloud',
  'Seguridad Informática',
  'Redes y Conectividad',
  'Hardware y Soporte Local',
  'Soporte de Aplicaciones',
] as const
export type Department = (typeof DEPARTMENTS)[number]

export const AREAS = [
  'Ventas',
  'Contabilidad',
  'Recursos Humanos',
  'Sistemas',
  'Operaciones',
  'Dirección',
] as const
export type Area = (typeof AREAS)[number]

export type Sentiment = 'Positivo' | 'Neutral' | 'Negativo'

export interface Analysis {
  confidence: number
  probabilities: Record<Priority, number>
  sentiment: Sentiment
  intent: string
  keywords: string[]
  devices: string[]
  errorCodes: string[]
}

export interface Ticket {
  id: string
  priority: Priority
  area: Area
  device: string
  department: Department
  status: TicketStatus
  createdAt: string
  reporter: string
  technician: string
  summary: string
  description: string
  highlights: string[]
  analysis: Analysis
  resolutionHours?: number
  resolvedAt?: string
  resolvedBy?: string
  solution?: string
  editedAfterClose?: boolean
}

export type TicketDateFilter = 'hoy' | '48' | '7'

export interface TicketQuery {
  priority?: Priority
  department?: Department
  status?: TicketStatus
  date?: TicketDateFilter
  search?: string
  page?: number
  pageSize?: number
}
