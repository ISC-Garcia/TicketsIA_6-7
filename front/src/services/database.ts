import { backups, tables } from '@/mocks/database'
import type { Backup, DatabaseTable } from '@/types/database'

import { mockRequest } from './mockRequest'

export function listTables(): Promise<DatabaseTable[]> {
  return mockRequest(() => tables)
}

export function listBackups(): Promise<Backup[]> {
  return mockRequest(() => backups)
}
