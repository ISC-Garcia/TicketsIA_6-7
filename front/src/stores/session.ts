import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { currentUser, login, logout } from '@/services/auth'
import { setAuthToken } from '@/services/http'
import type { User } from '@/types/user'

const STORAGE_KEY = 'tickets.session'
export const SESSION_EXPIRED = 'Tu sesión terminó. Vuelve a iniciar sesión.'

interface StoredSession {
  token: string
  user: User
}

// sessionStorage se borra al cerrar la pestaña: la sesión no sobrevive al navegador.
function readStoredSession(): StoredSession | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
    return typeof stored?.token === 'string' && stored.user ? stored : null
  } catch {
    return null
  }
}

export const useSessionStore = defineStore('session', () => {
  const stored = readStoredSession()
  const user = ref<User | null>(stored?.user ?? null)
  const token = ref<string | null>(stored?.token ?? null)
  // Aviso para el login cuando la sesión terminó sin que la persona la cerrara.
  const notice = ref('')
  const isAuthenticated = computed(() => user.value !== null)

  setAuthToken(token.value)

  function clear() {
    user.value = null
    token.value = null
    setAuthToken(null)
    sessionStorage.removeItem(STORAGE_KEY)
  }

  async function signIn(username: string, password: string) {
    const session = await login(username, password)
    user.value = session.user
    token.value = session.token
    notice.value = ''
    setAuthToken(session.token)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }

  // Registra el cierre en la bitácora; si el servidor no responde, la sesión se cierra igual.
  async function signOut() {
    try {
      if (token.value) await logout()
    } catch {
      // El cierre local no depende de la red.
    } finally {
      clear()
    }
  }

  // Al recargar la página se confirma con la API que la sesión guardada sigue vigente.
  // Si ya no lo es, el manejador de 401 la cierra; un fallo de red no la cierra.
  async function refresh() {
    if (!token.value) return
    try {
      user.value = await currentUser()
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: token.value, user: user.value }))
    } catch {
      // El aviso y la redirección los decide el manejador de 401.
    }
  }

  function expire() {
    if (!user.value) return
    clear()
    notice.value = SESSION_EXPIRED
  }

  return { user, token, notice, isAuthenticated, signIn, signOut, refresh, expire }
})
