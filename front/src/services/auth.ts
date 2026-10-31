import { users } from '@/mocks/users'
import type { User } from '@/types/user'

import { mockRequest, ServiceError } from './mockRequest'

const SIMULATED_PASSWORD = 'demo2026'

export class AuthError extends ServiceError {
  constructor() {
    super('Usuario o contraseña incorrectos.')
  }
}

// Una cuenta desactivada recibe el mismo error para no revelar qué usuarios existen.
export function login(username: string, password: string): Promise<User> {
  const normalized = username.trim().toLowerCase()

  return mockRequest(() => {
    const user = users.find((candidate) => candidate.username === normalized)
    if (!user?.active || password !== SIMULATED_PASSWORD) throw new AuthError()
    return user
  })
}
