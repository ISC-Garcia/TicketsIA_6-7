import type { Page } from '@/types/page'

const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 300

let failing = import.meta.env.VITE_MOCK_FAILURE === 'true'

export const setMockFailure = (value: boolean) => {
  failing = value
}

export class ServiceError extends Error {}

// Simula una llamada al back: responde tarde y con una copia, como lo haría una API.
export function mockRequest<T>(resolve: () => T, latency = LATENCY_MS): Promise<T> {
  return new Promise((done, fail) => {
    setTimeout(() => {
      if (failing) {
        fail(new ServiceError('No se pudo conectar con el servidor.'))
        return
      }
      try {
        done(structuredClone(resolve()))
      } catch (error) {
        fail(error)
      }
    }, latency)
  })
}

export function paginate<T>(items: T[], page = 1, pageSize = items.length): Page<T> {
  const start = (page - 1) * pageSize

  return { items: items.slice(start, start + pageSize), total: items.length }
}
