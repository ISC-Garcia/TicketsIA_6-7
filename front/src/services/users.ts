import type { NewUser, User } from '@/types/user'

import { request } from './http'

export function listUsers(): Promise<User[]> {
  return request('/api/users')
}

// El usuario nuevo entra con una contraseña temporal que debe cambiar en su primer acceso.
export function createUser(user: NewUser): Promise<User> {
  return request('/api/users', { method: 'POST', body: user })
}

export function setUserActive(username: string, active: boolean): Promise<User> {
  return request(`/api/users/${encodeURIComponent(username)}`, {
    method: 'PATCH',
    body: { active },
  })
}
