import type { Dashboard, DashboardPeriod } from '@/types/dashboard'

import { request } from './http'

// El periodo solo cambia la tendencia (P-7).
export function getDashboard(period: DashboardPeriod): Promise<Dashboard> {
  return request('/api/dashboard', { query: { period } })
}
