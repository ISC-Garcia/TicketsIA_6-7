/// <reference types="vitest/jsdom" />

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
