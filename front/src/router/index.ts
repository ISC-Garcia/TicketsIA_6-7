import { createRouter, createWebHistory } from 'vue-router'

import { useSessionStore } from '@/stores/session'

import { resolveAccess } from './guards'
import { routes } from './routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => resolveAccess(to, useSessionStore().user))

export default router
