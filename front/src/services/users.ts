import { users } from '@/mocks/users'
import type { User } from '@/types/user'

import { mockRequest } from './mockRequest'

export function listUsers(): Promise<User[]> {
  return mockRequest(() => users)
}
