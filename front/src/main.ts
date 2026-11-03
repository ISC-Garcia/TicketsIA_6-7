import './assets/styles/fonts.css'
import './assets/styles/tokens.css'
import './assets/styles/base.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// Sin back disponible, MSW responde en el navegador con los datos de src/mocks/.
async function startMockApi() {
  if (import.meta.env.VITE_API_MOCK !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

await startMockApi()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
