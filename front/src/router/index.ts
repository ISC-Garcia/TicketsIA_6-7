import { createRouter, createWebHistory } from 'vue-router'

import { setUnauthorizedHandler } from '@/services/http'
import { useSessionStore } from '@/stores/session'

import { resolveAccess } from './guards'
import { trackVisits } from './lastVisited'
import { routes } from './routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

trackVisits(router)

let sessionChecked = false

router.beforeEach(async (to) => {
  const session = useSessionStore()
  if (!sessionChecked) {
    sessionChecked = true
    await session.refresh()
  }
  return resolveAccess(to, session.user)
})

// Si la API rechaza el token a mitad de la sesión (venció o desactivaron la cuenta),
// se cierra la sesión y se vuelve al login con un aviso.
setUnauthorizedHandler(() => {
  const session = useSessionStore()
  if (!session.isAuthenticated) return
  session.expire()
  void router.push({ name: 'login' })
})

export default router
