import type { User } from '@/types/user'

import { request } from './http'

export function listUsers(): Promise<User[]> {
  return request('/api/users')
}
