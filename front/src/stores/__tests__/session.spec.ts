import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { AuthError } from '@/services/auth'

import { useSessionStore } from '../session'

describe('useSessionStore', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('inicia sin sesión', () => {
    expect(useSessionStore().isAuthenticated).toBe(false)
  })

  it('guarda la sesión para sobrevivir a una recarga', async () => {
    await useSessionStore().signIn('tecnico', 'demo2026')

    setActivePinia(createPinia())

    expect(useSessionStore().user?.username).toBe('tecnico')
  })

  it('cierra la sesión y la olvida', async () => {
    const session = useSessionStore()
    await session.signIn('tecnico', 'demo2026')

    session.signOut()
    setActivePinia(createPinia())

    expect(session.user).toBeNull()
    expect(useSessionStore().isAuthenticated).toBe(false)
  })

  it('no conserva sesión si las credenciales fallan', async () => {
    const session = useSessionStore()

    await expect(session.signIn('tecnico', 'mala')).rejects.toBeInstanceOf(AuthError)

    expect(session.isAuthenticated).toBe(false)
    expect(sessionStorage.length).toBe(0)
  })

  it('ignora una sesión guardada corrupta', () => {
    sessionStorage.setItem('tickets.session', '{no es json')

    expect(useSessionStore().isAuthenticated).toBe(false)
  })
})
