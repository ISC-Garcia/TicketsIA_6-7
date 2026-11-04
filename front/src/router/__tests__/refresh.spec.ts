import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { SESSION_EXPIRED, useSessionStore } from '@/stores/session'

// La primera navegación revisa la sesión guardada. El módulo del router guarda que ya lo hizo,
// así que esta prueba vive sola en su archivo.
describe('sesión guardada al recargar', () => {
  it('si la API ya no la acepta, vuelve al login con el aviso', async () => {
    sessionStorage.setItem(
      'tickets.session',
      JSON.stringify({
        token: 'simulado-nadie',
        user: { name: 'Nadie', username: 'nadie', role: 'tecnico', active: true },
      }),
    )
    setActivePinia(createPinia())
    const { default: router } = await import('../index')

    await router.push('/bandeja')

    const session = useSessionStore()
    expect(session.isAuthenticated).toBe(false)
    expect(session.notice).toBe(SESSION_EXPIRED)
    expect(router.currentRoute.value.name).toBe('login')
  })
})
