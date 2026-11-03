import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

import type { User } from '@/types/user'

import { ROLE_HOME } from './routes'

const homeOf = (user: User): RouteLocationRaw => ({ name: ROLE_HOME[user.role] })

export const PASSWORD_ROUTE = 'cambiar-contrasena'

export function resolveAccess(
  to: Pick<RouteLocationNormalized, 'meta' | 'name'>,
  user: User | null,
): true | RouteLocationRaw {
  // Con la contraseña temporal pendiente, la única pantalla disponible es la de cambiarla (P-4).
  if (to.name === PASSWORD_ROUTE) {
    if (!user) return { name: 'login' }
    return user.mustChangePassword ? true : homeOf(user)
  }
  if (user?.mustChangePassword) return { name: PASSWORD_ROUTE }
  if (to.meta.guest) return user ? homeOf(user) : true
  if (!to.meta.roles) return true
  if (!user) return { name: 'login' }
  return to.meta.roles.includes(user.role) ? true : homeOf(user)
}
