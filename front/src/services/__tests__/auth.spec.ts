import { afterEach, describe, expect, it } from 'vitest'

import { setMockFailure } from '@/mocks/handlers'
import { users } from '@/mocks/users'

import { AuthError, login } from '../auth'
import { ServiceError } from '../http'

describe('login', () => {
  afterEach(() => {
    setMockFailure(false)
    users.forEach((user) => {
      user.active = true
    })
  })

  it.each([
    ['tecnico', 'tecnico'],
    ['sxala', 'tecnico'],
    ['coordinador', 'coordinador'],
    ['auditor', 'auditor'],
  ])('%s entra con el rol %s', async (username, role) => {
    expect((await login(username, 'demo2026')).role).toBe(role)
  })

  it('normaliza el usuario pero no la contraseña', async () => {
    expect((await login('  TECNICO ', 'demo2026')).username).toBe('tecnico')
    await expect(login('tecnico', 'DEMO2026')).rejects.toBeInstanceOf(AuthError)
  })

  it.each([
    ['tecnico', 'incorrecta'],
    ['nadie', 'demo2026'],
  ])('rechaza %s con %s', async (username, password) => {
    await expect(login(username, password)).rejects.toThrow('Usuario o contraseña incorrectos.')
  })

  it('rechaza a un usuario desactivado aunque la contraseña sea correcta', async () => {
    users.find((user) => user.username === 'sxala')!.active = false

    await expect(login('sxala', 'demo2026')).rejects.toBeInstanceOf(AuthError)
  })

  it('distingue la falla de conexión de las credenciales incorrectas', async () => {
    setMockFailure(true)

    const failure = await login('tecnico', 'demo2026').catch((error) => error)

    expect(failure).toBeInstanceOf(ServiceError)
    expect(failure).not.toBeInstanceOf(AuthError)
  })
})
