import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'

import { lastVisitTo } from '@/router/lastVisited'

export interface Breadcrumb {
  label: string
  to?: RouteLocationRaw
  mono?: boolean
}

export function useBreadcrumbs() {
  const route = useRoute()
  const router = useRouter()

  return computed<Breadcrumb[]>(() => {
    const { meta, name, params } = route

    if (meta.parent) {
      const parent = { name: meta.parent }
      return [
        { label: router.resolve(parent).meta.title ?? '', to: lastVisitTo(meta.parent) },
        { label: String(params.id), mono: true },
      ]
    }

    if (meta.tabs && name) {
      const tabs = Object.values(meta.tabs)
      return [
        { label: meta.title ?? '', to: { name } },
        { label: meta.tabs[String(params.tab)] ?? tabs[0] ?? '' },
      ]
    }

    return [{ label: meta.title ?? '' }]
  })
}
