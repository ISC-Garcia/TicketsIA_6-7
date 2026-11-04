import type { ModelMetrics } from '@/types/model'

import { request } from './http'

// El `metricas.json` del modelo que la API tiene cargado.
export function getModelMetrics(): Promise<ModelMetrics> {
  return request('/api/model/metrics')
}
