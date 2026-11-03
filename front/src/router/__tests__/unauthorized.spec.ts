import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { createPinia, setActivePinia } from 'pinia'

import { server } from '@/mocks/server'
import { request } from '@/services/http'
import { SESSION_EXPIRED, useSessionStore } from '@/stores/session'

import router from '../index'

describe('sesión rechazada por la API', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
    server.use(
      http.get('*/api/eco', () =>
        HttpResponse.json({ detail: 'Tu sesión terminó.' }, { status: 401 }),
      ),
    )
  })

  it('cierra la sesión y vuelve al login con un aviso', async () => {
    const session = useSessionStore()
    await session.signIn('tecnico', 'demo2026')
    await router.push('/bandeja')

    await expect(request('/api/eco')).rejects.toThrow('Tu sesión terminó.')

    expect(session.isAuthenticated).toBe(false)
    expect(session.notice).toBe(SESSION_EXPIRED)
    // La vista del login se carga a demanda: se espera a que termine la navegación.
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'))
  })

  it('sin sesión no hace nada', async () => {
    const session = useSessionStore()

    await expect(request('/api/eco')).rejects.toThrow('Tu sesión terminó.')

    expect(session.notice).toBe('')
  })
})
