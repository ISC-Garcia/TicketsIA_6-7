import type { Backup, DatabaseStatus, DatabaseTable, MonitorPeriod } from '@/types/database'

export const tables: DatabaseTable[] = [
  {
    name: 'tickets',
    description:
      'Cada ticket de soporte: lo que se capturó, la clasificación de la IA y su atención.',
    rows: 99008,
    sizeBytes: 106_758_144,
    modifiedAt: '2026-10-28 10:14:08',
    columns: [
      {
        name: 'id',
        type: 'character varying(10)',
        description: 'Identificador del ticket, como TCK-200003',
      },
      {
        name: 'priority',
        type: 'character varying(10)',
        description: 'Prioridad: Crítica, Alta, Media o Baja',
      },
      { name: 'analysis', type: 'jsonb' },
    ],
  },
  {
    name: 'events',
    description: 'Bitácora: cada acción sobre el sistema, en orden cronológico.',
    rows: 31,
    sizeBytes: 81_920,
    modifiedAt: '2026-10-28 10:14:08',
    columns: [
      { name: 'time', type: 'timestamp with time zone', description: 'Momento del evento' },
    ],
  },
  {
    name: 'backups',
    description: 'Respaldos con pg_dump que se ejecutaron, exitosos o fallidos.',
    rows: 0,
    sizeBytes: 16_384,
    columns: [],
  },
]

// Un fallo con su reintento exitoso, y un respaldo normal.
export const backups: Backup[] = [
  {
    id: 3,
    startedAt: '2026-10-28 10:18:31',
    durationSeconds: 0.97,
    status: 'Exitoso',
    fileName: 'tickets-20261028-101831.dump',
    sizeBytes: 3_817_918,
    sha256: '9973e0fbf84110d8a60298e7ea4fcb3fe0c3e0486aa30b49f3f8365231f833b2',
  },
  {
    id: 2,
    startedAt: '2026-10-27 03:00:05',
    durationSeconds: 1.4,
    status: 'Exitoso',
    fileName: 'tickets-20261027-030005.dump',
    sizeBytes: 3_790_112,
    sha256: '1f2e3d4c5b6a79881f2e3d4c5b6a79881f2e3d4c5b6a79881f2e3d4c5b6a7988',
    retryOfId: 1,
  },
  {
    id: 1,
    startedAt: '2026-10-27 03:00:00',
    durationSeconds: 0.2,
    status: 'Fallido',
    fileName: 'tickets-20261027-030000.dump',
    detail: 'pg_dump: error: connection to server failed',
  },
]

const HOURS = Array.from(
  { length: 24 },
  (_, index) => `${String((index + 12) % 24).padStart(2, '0')}:00`,
)

// Estado como lo devuelve la API, con huecos en las primeras horas: aún no había muestras.
export function databaseStatus(period: MonitorPeriod): DatabaseStatus {
  const labels =
    period === '24h'
      ? HOURS
      : Array.from({ length: period === 'semana' ? 7 : 30 }, (_, index) => `Día ${index + 1}`)
  const filled = (values: number[]) =>
    labels.map((_, index) =>
      index < labels.length - values.length
        ? null
        : values[index - (labels.length - values.length)]!,
    )
  return {
    checkedAt: '2026-10-28 11:42:10',
    server: {
      online: true,
      version: '17.11',
      startedAt: '2026-10-16 07:30:00',
      uptimeSeconds: 12 * 86400 + 4 * 3600 + 12 * 60,
    },
    connections: { active: 8, max: 100 },
    latencyMs: 1.2,
    queriesPerMinute: 142,
    sizeBytes: 486 * 1024 * 1024,
    cacheHitRatio: 99.4,
    trend: {
      period,
      subtitle: period === '24h' ? 'Últimas 24 horas, por hora' : 'Por día',
      labels,
      queriesPerHour: filled([2100, 2500, 3100, 6200, 8100, 8520]),
      connections: filled([2, 3, 4, 6, 8, 8]),
    },
    slowQueries: {
      available: true,
      items: [
        { query: 'SELECT count(*) FROM tickets WHERE status = $1', meanMs: 120.4, calls: 1284 },
        {
          query: 'SELECT * FROM tickets ORDER BY priority_rank, created_at LIMIT $1',
          meanMs: 84,
          calls: 18402,
        },
      ],
    },
  }
}
