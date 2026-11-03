import type { User } from '@/types/user'

import { request, ServiceError } from './http'

const UNAUTHORIZED = 401

export class AuthError extends ServiceError {
  constructor(message = 'Usuario o contraseña incorrectos.') {
    super(message, UNAUTHORIZED)
  }
}

interface LoginResponse {
  token: string
  user: User
}

// Una cuenta desactivada recibe el mismo error para no revelar qué usuarios existen.
export async function login(username: string, password: string): Promise<User> {
  try {
    const { user } = await request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { username: username.trim().toLowerCase(), password },
    })
    return user
  } catch (error) {
    if (error instanceof ServiceError && error.status === UNAUTHORIZED) {
      throw new AuthError(error.message)
    }
    throw error
  }
}
