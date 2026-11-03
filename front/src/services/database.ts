import type { Backup, DatabaseTable } from '@/types/database'

import { request } from './http'

export function listTables(): Promise<DatabaseTable[]> {
  return request('/api/database/tables')
}

export function listBackups(): Promise<Backup[]> {
  return request('/api/database/backups')
}
