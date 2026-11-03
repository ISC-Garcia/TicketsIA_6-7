/// <reference types="vitest/jsdom" />

import { afterAll, afterEach, beforeAll } from 'vitest'

import { setMockFailure } from '@/mocks/handlers'
import { server } from '@/mocks/server'

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

// Las llamadas a la API las responde MSW con los datos de src/mocks/. Una ruta sin manejador
// hace fallar la prueba en lugar de salir a la red.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  setMockFailure(false)
})
afterAll(() => server.close())
