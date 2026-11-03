export interface TableColumn {
  name: string
  type: string
  description: string
}

export interface DatabaseTable {
  name: string
  rows: number
  size: string
  modifiedAt: string
  description: string
  columns: TableColumn[]
}

export interface Backup {
  date: string
  size: string
  duration: string
  status: 'Exitoso' | 'Fallido'
  detail?: string
  isRetry?: boolean
}

export const MONITOR_PERIODS = ['24h', 'semana', 'mes'] as const
export type MonitorPeriod = (typeof MONITOR_PERIODS)[number]

// Un valor nulo es un tramo sin muestras: la gráfica lo deja vacío.
export interface MonitorTrend {
  period: MonitorPeriod
  subtitle: string
  labels: string[]
  queriesPerHour: (number | null)[]
  connections: (number | null)[]
}

export interface SlowQuery {
  query: string
  meanMs: number
  calls: number
}

// Sin conexión con PostgreSQL solo llegan `checkedAt` y `server.online`.
export interface DatabaseStatus {
  checkedAt: string
  server: { online: boolean; version?: string; startedAt?: string; uptimeSeconds?: number }
  connections?: { active: number; max: number }
  latencyMs?: number
  queriesPerMinute?: number
  sizeBytes?: number
  cacheHitRatio?: number
  trend?: MonitorTrend
  // `available` es falso si pg_stat_statements no está activa en el servidor.
  slowQueries?: { available: boolean; items: SlowQuery[] }
}
