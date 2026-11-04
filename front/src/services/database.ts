import type {
  Backup,
  DatabaseStatus,
  DatabaseTable,
  IntegrityReport,
  MonitorPeriod,
} from '@/types/database'

import { request } from './http'

export function listTables(): Promise<DatabaseTable[]> {
  return request('/api/database/tables')
}

export function listBackups(): Promise<Backup[]> {
  return request('/api/database/backups')
}

export function getDatabaseStatus(period: MonitorPeriod): Promise<DatabaseStatus> {
  return request('/api/database/status', { query: { period } })
}

// Recalcula la huella SHA-256 de tickets, eventos y respaldos (E9-05).
export function verifyIntegrity(): Promise<IntegrityReport> {
  return request('/api/database/integrity')
}
