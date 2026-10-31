import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { login } from '@/services/auth'
import type { User } from '@/types/user'

const STORAGE_KEY = 'tickets.session'

function readStoredUser(): User | null {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    return null
  }
}

export const useSessionStore = defineStore('session', () => {
  const user = ref<User | null>(readStoredUser())
  const isAuthenticated = computed(() => user.value !== null)

  async function signIn(username: string, password: string) {
    user.value = await login(username, password)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user.value))
  }

  function signOut() {
    user.value = null
    sessionStorage.removeItem(STORAGE_KEY)
  }

  return { user, isAuthenticated, signIn, signOut }
})
