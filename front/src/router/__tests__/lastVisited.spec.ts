import { beforeEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { forgetVisits, lastVisitTo, rememberVisit, trackVisits } from '../lastVisited'

const view = { render: () => h('div') }

describe('lastVisited', () => {
  beforeEach(() => forgetVisits())

  it('sin visitas previas devuelve la vista sin filtros', () => {
    expect(lastVisitTo('bandeja')).toEqual({ name: 'bandeja' })
  })

  it('recuerda la última dirección de cada vista al navegar', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/bandeja', name: 'bandeja', component: view },
        { path: '/bandeja/:id', name: 'bandeja-detalle', component: view },
      ],
    })
    trackVisits(router)

    await router.push('/bandeja?prioridad=Baja')
    await router.push('/bandeja?prioridad=Alta&pagina=2')
    await router.push('/bandeja/TCK-200011')

    expect(router.resolve(lastVisitTo('bandeja')).fullPath).toBe('/bandeja?prioridad=Alta&pagina=2')
  })

  it('ignora rutas sin nombre', () => {
    rememberVisit({ name: undefined, query: {}, params: {} })

    expect(lastVisitTo('bandeja')).toEqual({ name: 'bandeja' })
  })
})
