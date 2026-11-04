import { ref } from 'vue'
import { defineStore } from 'pinia'

export const TOAST_DURATION_MS = 4000

export interface Toast {
  id: number
  message: string
  detail?: string
}

export const useToastStore = defineStore('toast', () => {
  const current = ref<Toast | null>(null)

  let nextId = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  // Un aviso nuevo reemplaza al anterior y reinicia el tiempo, como en el prototipo.
  function show(message: string, detail?: string) {
    clearTimeout(timer)
    nextId += 1
    current.value = { id: nextId, message, detail }
    timer = setTimeout(close, TOAST_DURATION_MS)
  }

  function close() {
    clearTimeout(timer)
    current.value = null
  }

  return { current, show, close }
})
