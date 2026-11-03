import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { Role, User } from '@/types/user'

import { resolveAccess } from '../guards'
import { routes } from '../routes'

const userWith = (role: Role): User => ({ name: 'Ana', username: 'ana', role, active: true })

function createGuardedRouter(user: User | null) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.beforeEach((to) => resolveAccess(to, user))
  return router
}

async function finalPath(user: User | null, path: string) {
  const router = createGuardedRouter(user)
  await router.push(path)
  return router.currentRoute.value.path
}

const ROUTES_BY_ROLE: [Role, string[]][] = [
  ['tecnico', ['/registrar', '/bandeja', '/bandeja/TCK-200003']],
  [
    'coordinador',
    ['/dashboard', '/general', '/general/TCK-200003', '/modelo', '/modelo/matriz', '/usuarios'],
  ],
  ['auditor', ['/monitoreo', '/monitoreo/tablas', '/bitacora', '/historial', '/historial/TCK-1']],
]

const HOME_BY_ROLE: Record<Role, string> = {
  tecnico: '/bandeja',
  coordinador: '/dashboard',
  auditor: '/monitoreo',
}

describe('sin sesión', () => {
  it.each(ROUTES_BY_ROLE.flatMap(([, paths]) => paths))('%s redirige a /login', async (path) => {
    expect(await finalPath(null, path)).toBe('/login')
  })

  it.each(['/', '/no-existe'])('%s lleva a /login', async (path) => {
    expect(await finalPath(null, path)).toBe('/login')
  })
})

describe.each(ROUTES_BY_ROLE)('con el rol %s', (role, ownPaths) => {
  const home = HOME_BY_ROLE[role]
  const otherPaths = ROUTES_BY_ROLE.filter(([other]) => other !== role).flatMap(
    ([, paths]) => paths,
  )

  it.each(ownPaths)('entra a %s', async (path) => {
    expect(await finalPath(userWith(role), path)).toBe(path)
  })

  it.each(otherPaths)('%s redirige a su inicio', async (path) => {
    expect(await finalPath(userWith(role), path)).toBe(home)
  })

  it.each(['/', '/login', '/no-existe'])('%s lleva a su inicio', async (path) => {
    expect(await finalPath(userWith(role), path)).toBe(home)
  })
})
