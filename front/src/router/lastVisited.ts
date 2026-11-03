import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router'

// Última dirección visitada de cada vista, con sus filtros. El breadcrumb del detalle la usa
// para volver a la bandeja tal como estaba.
const lastVisited = new Map<string, RouteLocationRaw>()

export function rememberVisit(route: Pick<RouteLocationNormalized, 'name' | 'query' | 'params'>) {
  if (typeof route.name !== 'string') return
  lastVisited.set(route.name, { name: route.name, query: route.query, params: route.params })
}

export const lastVisitTo = (name: string): RouteLocationRaw => lastVisited.get(name) ?? { name }

export function trackVisits(router: Router) {
  router.afterEach((to) => rememberVisit(to))
}

export const forgetVisits = () => lastVisited.clear()
