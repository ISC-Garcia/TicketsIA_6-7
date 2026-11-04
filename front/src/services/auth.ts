import type { User } from '@/types/user'

import { request, ServiceError } from './http'

const UNAUTHORIZED = 401

export class AuthError extends ServiceError {
  constructor(message = 'Usuario o contraseña incorrectos.') {
    super(message, UNAUTHORIZED)
  }
}

export interface Session {
  token: string
  user: User
}

// Una cuenta desactivada recibe el mismo error para no revelar qué usuarios existen.
export async function login(username: string, password: string): Promise<Session> {
  try {
    return await request<Session>('/api/auth/login', {
      method: 'POST',
      body: { username: username.trim().toLowerCase(), password },
    })
  } catch (error) {
    if (error instanceof ServiceError && error.status === UNAUTHORIZED) {
      throw new AuthError(error.message)
    }
    throw error
  }
}

export function logout(): Promise<void> {
  return request('/api/auth/logout', { method: 'POST' })
}

export function currentUser(): Promise<User> {
  return request('/api/auth/me')
}

// Entrega una sesión completa: el token del primer acceso solo sirve para esto.
export function changePassword(currentPassword: string, newPassword: string): Promise<Session> {
  return request('/api/auth/password', { method: 'POST', body: { currentPassword, newPassword } })
}
