import { test as base, expect } from '@playwright/test'

import { API_URL } from '../playwright.config'

// Antes de cada prueba la API recarga la semilla demo: todas empiezan con los mismos datos.
export const test = base.extend<{ resetDatabase: void }>({
  resetDatabase: [
    async ({ request }, use) => {
      const response = await request.post(`${API_URL}/api/test/reset`)
      expect(response.status(), 'la API de pruebas debe aceptar el reinicio').toBe(204)
      await use()
    },
    { auto: true },
  ],
})

export { expect }
