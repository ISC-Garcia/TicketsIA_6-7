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
  // Los tickets históricos del dataset no tienen técnico ni análisis del modelo.
  technician?: string
  // Usuario del técnico: permite saber si el ticket es de quien tiene la sesión.
  technicianUsername?: string
  summary: string
  description: string
  highlights: string[]
  analysis?: Analysis
  resolutionHours?: number
  resolvedAt?: string
  resolvedBy?: string
  resolvedByUsername?: string
  solution?: string
  editedAfterClose?: boolean
}

// Lo que captura el técnico al registrar.
export interface TicketDraft {
  area: Area
  reporter: string
  description: string
  device?: string
}

// Resultado de analizar una captura, antes de guardarla.
export interface DraftAnalysis {
  priority: Priority
  department: Department
  device: string
  // El dispositivo no se escribió y se tomó de la descripción.
  deviceDetected: boolean
  highlights: string[]
  analysis: Analysis
}

export interface Resolution {
  solution: string
  resolutionHours: number
}

// Técnico activo con su carga, para reasignar.
export interface Technician {
  username: string
  name: string
  openTickets: number
}

export const TICKET_DATE_FILTERS = ['hoy', '48', '7'] as const
export type TicketDateFilter = (typeof TICKET_DATE_FILTERS)[number]

export interface TicketQuery {
  priority?: Priority
  department?: Department
  status?: TicketStatus
  date?: TicketDateFilter
  search?: string
  page?: number
  pageSize?: number
}
