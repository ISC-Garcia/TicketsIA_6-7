import type { Priority, Ticket } from './ticket'

export const DASHBOARD_PERIODS = ['semana', 'mes', 'año'] as const
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number]

// Cada indicador viene con su valor en la ventana anterior para calcular la variación.
// Un valor nulo significa que no hubo tickets resueltos en esa ventana.
export interface DashboardKpis {
  openTickets: number
  openTicketsBefore: number
  criticalOpen: number
  criticalOpenBefore: number
  averageResolutionHours: number | null
  averageResolutionHoursBefore: number | null
  slaCompliance: number | null
  slaComplianceBefore: number | null
}

export interface CountRow {
  label: string
  count: number
}

export interface Trend {
  period: DashboardPeriod
  subtitle: string
  labels: string[]
  created: number[]
  resolved: number[]
}

export interface ResolutionVsSla {
  priority: Priority
  averageHours: number | null
  slaHours: number
}

export interface Dashboard {
  kpis: DashboardKpis
  byPriority: CountRow[]
  total: number
  byDepartment: CountRow[]
  trend: Trend
  resolutionVsSla: ResolutionVsSla[]
  critical: Ticket[]
}
