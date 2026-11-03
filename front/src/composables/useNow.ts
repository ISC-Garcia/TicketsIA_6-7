import { onMounted, onUnmounted, ref } from 'vue'

import { now } from '@/utils/clock'

// Cada cuánto se recalculan la fecha, la antigüedad y el SLA en pantalla.
export const TICK_MS = 30_000

// La hora actual como ref, para que lo que depende de ella avance solo.
export function useNow(intervalMs = TICK_MS) {
  const current = ref(now())
  let timer: ReturnType<typeof setInterval> | undefined

  onMounted(() => {
    timer = setInterval(() => {
      current.value = now()
    }, intervalMs)
  })
  onUnmounted(() => clearInterval(timer))

  return current
}
