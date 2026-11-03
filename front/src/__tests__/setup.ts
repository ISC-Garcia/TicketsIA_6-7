/// <reference types="vitest/jsdom" />

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

import { resetMockData, setMockFailure } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { syncClock } from '@/utils/clock'

// Node define su propio localStorage, inutilizable sin --localstorage-file, que tapa al de jsdom.
Object.defineProperty(globalThis, 'localStorage', {
  value: jsdom.window.localStorage,
  configurable: true,
})

// jsdom no implementa los métodos de <dialog>.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '')
}

HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open')
}

// Las pruebas fijan la hora en la de los datos simulados, como la API de pruebas con APP_NOW.
// Solo se cambia la fecha: los temporizadores siguen siendo reales.
export const TEST_NOW = new Date('2026-10-28T11:42:10')
beforeEach(() => {
  vi.setSystemTime(TEST_NOW)
  syncClock(TEST_NOW.toISOString())
})

// Las llamadas a la API las responde MSW con los datos de src/mocks/. Una ruta sin manejador
// hace fallar la prueba en lugar de salir a la red.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  setMockFailure(false)
  resetMockData()
})
afterAll(() => {
  server.close()
  vi.useRealTimers()
})
