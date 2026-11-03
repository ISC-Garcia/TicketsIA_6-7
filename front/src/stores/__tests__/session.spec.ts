import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { createPinia, setActivePinia } from 'pinia'

import { server } from '@/mocks/server'
import { AuthError } from '@/services/auth'
import { request, setAuthToken } from '@/services/http'

import { SESSION_EXPIRED, useSessionStore } from '../session'

function captureAuthorization() {
  const seen: (string | null)[] = []
  server.use(
    http.get('*/api/eco', ({ request: incoming }) => {
      seen.push(incoming.headers.get('authorization'))
      return HttpResponse.json({})
    }),
  )
  return seen
}

describe('useSessionStore', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => setAuthToken(null))

  it('inicia sin sesión', () => {
    expect(useSessionStore().isAuthenticated).toBe(false)
  })

  it('guarda la sesión con su token para sobrevivir a una recarga', async () => {
    await useSessionStore().signIn('tecnico', 'demo2026')

    setAuthToken(null)
    setActivePinia(createPinia())
    const restored = useSessionStore()
    const seen = captureAuthorization()
    await request('/api/eco')

    expect(restored.user?.username).toBe('tecnico')
    expect(restored.token).toBe('simulado-tecnico')
    expect(seen).toEqual(['Bearer simulado-tecnico'])
  })

  it('cierra la sesión en el servidor y la olvida', async () => {
    let closed = 0
    server.use(
      http.post('*/api/auth/logout', () => {
        closed += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const session = useSessionStore()
    await session.signIn('tecnico', 'demo2026')

    await session.signOut()
    setActivePinia(createPinia())
    const seen = captureAuthorization()
    await request('/api/eco')

    expect(closed).toBe(1)
    expect(session.user).toBeNull()
    expect(useSessionStore().isAuthenticated).toBe(false)
    expect(seen).toEqual([null])
  })

  it('cierra la sesión aunque el servidor no responda', async () => {
    const session = useSessionStore()
    await session.signIn('tecnico', 'demo2026')
    server.use(http.post('*/api/auth/logout', () => HttpResponse.error()))

    await session.signOut()

    expect(session.isAuthenticated).toBe(false)
    expect(sessionStorage.length).toBe(0)
  })

  it('no conserva sesión si las credenciales fallan', async () => {
    const session = useSessionStore()

    await expect(session.signIn('tecnico', 'mala')).rejects.toBeInstanceOf(AuthError)

    expect(session.isAuthenticated).toBe(false)
    expect(sessionStorage.length).toBe(0)
  })

  it('al vencer la sesión la olvida y deja un aviso para el login', async () => {
    const session = useSessionStore()
    await session.signIn('coordinador', 'demo2026')

    session.expire()

    expect(session.isAuthenticated).toBe(false)
    expect(session.notice).toBe(SESSION_EXPIRED)
    expect(sessionStorage.length).toBe(0)

    await session.signIn('coordinador', 'demo2026')
    expect(session.notice).toBe('')
  })

  it('al recargar confirma la sesión con la API y actualiza el usuario', async () => {
    const session = useSessionStore()
    await session.signIn('auditor', 'demo2026')
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json({ ...session.user, name: 'Nombre actualizado' }),
      ),
    )

    await session.refresh()

    expect(session.user?.name).toBe('Nombre actualizado')
    expect(sessionStorage.getItem('tickets.session')).toContain('Nombre actualizado')
  })

  it('al recargar sin conexión conserva la sesión', async () => {
    const session = useSessionStore()
    await session.signIn('auditor', 'demo2026')
    server.use(http.get('*/api/auth/me', () => HttpResponse.error()))

    await session.refresh()

    expect(session.isAuthenticated).toBe(true)
  })

  it('sin sesión no consulta la API al recargar', async () => {
    let calls = 0
    server.use(
      http.get('*/api/auth/me', () => {
        calls += 1
        return HttpResponse.json({})
      }),
    )

    await useSessionStore().refresh()

    expect(calls).toBe(0)
  })

  it('sin sesión no deja aviso al vencer', () => {
    const session = useSessionStore()

    session.expire()

    expect(session.notice).toBe('')
  })

  it.each([['{no es json'], ['{"user":{"username":"tecnico"}}']])(
    'ignora una sesión guardada inválida: %s',
    (stored) => {
      sessionStorage.setItem('tickets.session', stored)

      expect(useSessionStore().isAuthenticated).toBe(false)
    },
  )

  it('E5-03: cambiar la contraseña guarda la sesión nueva', async () => {
    const session = useSessionStore()
    await session.signIn('auditor', 'demo2026')

    await session.updatePassword('demo2026', 'nueva-clave-1')

    expect(session.user?.mustChangePassword).toBe(false)
    expect(JSON.parse(sessionStorage.getItem('tickets.session')!).user.username).toBe('auditor')
    await expect(session.signIn('auditor', 'demo2026')).rejects.toBeInstanceOf(AuthError)
    await session.signIn('auditor', 'nueva-clave-1')
  })
})
