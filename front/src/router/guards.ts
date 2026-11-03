import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

import type { User } from '@/types/user'

import { ROLE_HOME } from './routes'

const homeOf = (user: User): RouteLocationRaw => ({ name: ROLE_HOME[user.role] })

export function resolveAccess(
  to: Pick<RouteLocationNormalized, 'meta'>,
  user: User | null,
): true | RouteLocationRaw {
  if (to.meta.guest) return user ? homeOf(user) : true
  if (!to.meta.roles) return true
  if (!user) return { name: 'login' }
  return to.meta.roles.includes(user.role) ? true : homeOf(user)
}
