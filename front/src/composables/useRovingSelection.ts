import { nextTick, ref } from 'vue'

const nextIndex = (key: string, index: number, length: number): number | null => {
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % length
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + length) % length
  if (key === 'Home') return 0
  if (key === 'End') return length - 1
  return null
}

// Navegación con flechas para grupos donde solo la opción activa recibe foco con Tab.
export function useRovingSelection<T extends string>(
  options: () => readonly { key: T }[],
  current: () => T,
  select: (key: T) => void,
) {
  const container = ref<HTMLElement | null>(null)

  async function onKeydown(event: KeyboardEvent) {
    const keys = options().map((option) => option.key)
    const target = nextIndex(event.key, keys.indexOf(current()), keys.length)
    if (target === null) return

    event.preventDefault()
    select(keys[target]!)
    await nextTick()
    container.value?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
  }

  return { container, onKeydown }
}
