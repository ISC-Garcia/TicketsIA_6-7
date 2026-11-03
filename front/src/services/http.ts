export const CONNECTION_ERROR = 'No se pudo conectar con el servidor.'
const UNEXPECTED_ERROR = 'El servidor respondió con un error inesperado.'

export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
  }
}

export type QueryValue = string | number | boolean | undefined | null
export type Query = Record<string, QueryValue>

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Query
  body?: unknown
}

// Vacío en desarrollo: Vite reenvía /api al back. En producción apunta al servicio de la API.
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

let token: string | null = null
let onUnauthorized: (() => void) | null = null

export const setAuthToken = (value: string | null) => {
  token = value
}

// La sesión registra aquí qué hacer cuando el servidor ya no acepta el token.
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler
}

export function buildUrl(path: string, query: Query = {}) {
  const url = new URL(API_URL + path, window.location.origin)
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    url.searchParams.set(key, String(value))
  }
  return url
}

async function errorDetail(response: Response) {
  try {
    const body = await response.json()
    if (typeof body?.detail === 'string') return body.detail
  } catch {
    // La respuesta no traía JSON: se usa el mensaje genérico.
  }
  return UNEXPECTED_ERROR
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ServiceError(CONNECTION_ERROR)
  }

  if (!response.ok) {
    if (response.status === 401 && token) onUnauthorized?.()
    throw new ServiceError(await errorDetail(response), response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
