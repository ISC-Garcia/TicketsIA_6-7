import './assets/styles/fonts.css'
import './assets/styles/tokens.css'
import './assets/styles/base.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { syncClockWithServer } from './services/health'

// Antes de mostrar nada, el front toma la hora del servidor como referencia.
await syncClockWithServer()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
