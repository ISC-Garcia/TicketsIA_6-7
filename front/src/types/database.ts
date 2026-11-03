export interface TableColumn {
  name: string
  // Tipo de PostgreSQL, como "character varying(10)".
  type: string
  description?: string
}

// Las descripciones son los COMMENT ON de la base.
export interface DatabaseTable {
  name: string
  description?: string
  rows: number
  sizeBytes: number
  // Fecha de su dato más reciente; falta si la tabla está vacía.
  modifiedAt?: string
  columns: TableColumn[]
}

export interface Backup {
  id: number
  startedAt: string
  durationSeconds: number
  status: 'Exitoso' | 'Fallido'
  fileName: string
  sizeBytes?: number
  sha256?: string
  detail?: string
  // El respaldo fallido que este reintento repite.
  retryOfId?: number
}

export const MONITOR_TABS = ['estado', 'tablas', 'respaldos'] as const
export type MonitorTab = (typeof MONITOR_TABS)[number]

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

export interface TableIntegrity {
  name: string
  verified: number
  mismatched: number
  // Hasta 20 IDs alterados; `mismatched` es el total.
  examples: string[]
}

export interface BackupIntegrity {
  id: number
  fileName: string
  startedAt: string
  result: 'Íntegro' | 'Alterado' | 'No encontrado'
}

export interface IntegrityReport {
  checkedAt: string
  tables: TableIntegrity[]
  backups: BackupIntegrity[]
}
