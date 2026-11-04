import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { TOAST_DURATION_MS, useToastStore } from '../toast'

describe('useToastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('muestra el aviso con su detalle', () => {
    const toast = useToastStore()

    toast.show('Ticket resuelto', 'TCK-197420, 2.00 h')

    expect(toast.current).toMatchObject({
      message: 'Ticket resuelto',
      detail: 'TCK-197420, 2.00 h',
    })
  })

  it('se cierra solo a los 4 segundos', () => {
    const toast = useToastStore()
    toast.show('Ticket resuelto')

    vi.advanceTimersByTime(TOAST_DURATION_MS - 1)
    expect(toast.current).not.toBeNull()

    vi.advanceTimersByTime(1)
    expect(toast.current).toBeNull()
  })

  it('un aviso nuevo reemplaza al anterior y reinicia el tiempo', () => {
    const toast = useToastStore()
    toast.show('Ticket resuelto')
    const first = toast.current?.id

    vi.advanceTimersByTime(3000)
    toast.show('Técnico reasignado')
    vi.advanceTimersByTime(3000)

    expect(toast.current?.message).toBe('Técnico reasignado')
    expect(toast.current?.id).not.toBe(first)
  })

  it('se puede cerrar antes de tiempo', () => {
    const toast = useToastStore()
    toast.show('Ticket resuelto')

    toast.close()

    expect(toast.current).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })
})
