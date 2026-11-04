import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'

import { server } from '@/mocks/server'

import {
  buildUrl,
  CONNECTION_ERROR,
  request,
  ServiceError,
  setAuthToken,
  setUnauthorizedHandler,
} from '../http'

afterEach(() => {
  setAuthToken(null)
  setUnauthorizedHandler(null)
})

describe('buildUrl', () => {
  it('omite los filtros vacíos y convierte el resto en texto', () => {
    const url = buildUrl('/api/tickets', {
      priority: 'Alta',
      page: 2,
      resolved: true,
      search: '',
      status: undefined,
      date: null,
      afterClose: false,
    })

    expect(url.pathname).toBe('/api/tickets')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      priority: 'Alta',
      page: '2',
      resolved: 'true',
    })
  })
})

describe('request', () => {
  it('envía JSON y el token, y devuelve la respuesta', async () => {
    let received: Request | undefined
    server.use(
      http.post('*/api/eco', async ({ request: incoming }) => {
        received = incoming.clone()
        return HttpResponse.json(await incoming.json())
      }),
    )
    setAuthToken('abc')

    const body = await request('/api/eco', { method: 'POST', body: { hola: 'mundo' } })

    expect(body).toEqual({ hola: 'mundo' })
    expect(received?.headers.get('authorization')).toBe('Bearer abc')
    expect(received?.headers.get('content-type')).toBe('application/json')
  })

  it('no envía encabezado de sesión sin token', async () => {
    let authorization: string | null = 'pendiente'
    server.use(
      http.get('*/api/eco', ({ request: incoming }) => {
        authorization = incoming.headers.get('authorization')
        return HttpResponse.json({})
      }),
    )

    await request('/api/eco')

    expect(authorization).toBeNull()
  })

  it('devuelve undefined en una respuesta sin contenido', async () => {
    server.use(http.post('*/api/eco', () => new HttpResponse(null, { status: 204 })))

    expect(await request('/api/eco', { method: 'POST' })).toBeUndefined()
  })

  it('usa el detalle del servidor como mensaje y conserva el estado', async () => {
    server.use(
      http.get('*/api/eco', () => HttpResponse.json({ detail: 'No existe.' }, { status: 404 })),
    )

    const error = (await request('/api/eco').catch((caught) => caught)) as ServiceError

    expect(error).toBeInstanceOf(ServiceError)
    expect(error.message).toBe('No existe.')
    expect(error.status).toBe(404)
  })

  it('conserva los errores de validación por campo', async () => {
    server.use(
      http.post('*/api/eco', () =>
        HttpResponse.json(
          {
            detail: 'Revisa los datos enviados.',
            errors: [{ field: 'description', message: 'Debe tener al menos 20 caracteres.' }],
          },
          { status: 422 },
        ),
      ),
    )

    const error = (await request('/api/eco', { method: 'POST' }).catch(
      (caught) => caught,
    )) as ServiceError

    expect(error.status).toBe(422)
    expect(error.fields).toEqual({ description: 'Debe tener al menos 20 caracteres.' })
  })

  it('usa un mensaje genérico si el error JSON no trae detalle', async () => {
    server.use(http.get('*/api/eco', () => HttpResponse.json({ otro: 1 }, { status: 500 })))

    const error = (await request('/api/eco').catch((caught) => caught)) as ServiceError

    expect(error.message).toBe('El servidor respondió con un error inesperado.')
    expect(error.status).toBe(500)
  })

  it('usa un mensaje genérico si el JSON del error no se puede leer', async () => {
    server.use(
      http.get(
        '*/api/eco',
        () =>
          new HttpResponse('{roto', {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    await expect(request('/api/eco')).rejects.toThrow(
      'El servidor respondió con un error inesperado.',
    )
  })

  it.each([
    [502, 'el proxy de Vite con el back apagado'],
    [404, 'un servidor que no conoce /api'],
  ])('un %i sin JSON (%s) es un error de conexión', async (status) => {
    server.use(http.get('*/api/eco', () => new HttpResponse('Bad Gateway', { status })))

    const error = (await request('/api/eco').catch((caught) => caught)) as ServiceError

    expect(error.message).toBe(CONNECTION_ERROR)
    expect(error.status).toBeUndefined()
  })

  it('convierte una falla de red en el error de conexión', async () => {
    server.use(http.get('*/api/eco', () => HttpResponse.error()))

    const error = (await request('/api/eco').catch((caught) => caught)) as ServiceError

    expect(error.message).toBe(CONNECTION_ERROR)
    expect(error.status).toBeUndefined()
  })

  it('avisa a la sesión cuando el servidor rechaza el token', async () => {
    const unauthorized = vi.fn<() => void>()
    server.use(
      http.get('*/api/eco', () =>
        HttpResponse.json({ detail: 'Sesión vencida.' }, { status: 401 }),
      ),
    )
    setUnauthorizedHandler(unauthorized)

    await expect(request('/api/eco')).rejects.toThrow('Sesión vencida.')
    expect(unauthorized).not.toHaveBeenCalled()

    setAuthToken('vencido')
    await expect(request('/api/eco')).rejects.toThrow('Sesión vencida.')
    expect(unauthorized).toHaveBeenCalledOnce()
  })
})
