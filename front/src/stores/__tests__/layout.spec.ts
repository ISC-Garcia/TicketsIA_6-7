import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useLayoutStore } from '../layout'

describe('useLayoutStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('inicia expandido', () => {
    expect(useLayoutStore().sidebarCollapsed).toBe(false)
  })

  it('recuerda el estado entre sesiones', () => {
    useLayoutStore().toggleSidebar()

    setActivePinia(createPinia())

    expect(useLayoutStore().sidebarCollapsed).toBe(true)
  })

  it('vuelve a expandirse', () => {
    const layout = useLayoutStore()

    layout.toggleSidebar()
    layout.toggleSidebar()

    expect(layout.sidebarCollapsed).toBe(false)
  })
})
