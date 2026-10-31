import { ref } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'tickets.sidebar-collapsed'

function readStoredState() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export const useLayoutStore = defineStore('layout', () => {
  const sidebarCollapsed = ref(readStoredState())

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    try {
      localStorage.setItem(STORAGE_KEY, String(sidebarCollapsed.value))
    } catch {
      // Sin almacenamiento disponible, el estado dura lo que dure la página.
    }
  }

  return { sidebarCollapsed, toggleSidebar }
})
