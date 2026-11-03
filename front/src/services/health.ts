import { syncClock } from '@/utils/clock'

import { request } from './http'

export interface Health {
  status: 'ok' | 'degradado'
  database: boolean
  modelLoaded: boolean
  // Hora del servidor con zona, como "2026-11-03T09:26:11-06:00".
  now: string
}

export function getHealth(): Promise<Health> {
  return request('/api/health')
}

// Toma la hora del servidor como referencia. Si la API no responde, se queda con la del equipo
// y la pantalla de login mostrará el error de conexión al intentar entrar.
export async function syncClockWithServer() {
  try {
    syncClock((await getHealth()).now)
  } catch {
    // Sin API no hay hora de referencia: se usa el reloj del equipo.
  }
}
