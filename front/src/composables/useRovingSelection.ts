import { ref } from 'vue'

const nextIndex = (key: string, index: number, length: number): number | null => {
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % length
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + length) % length
  if (key === 'Home') return 0
  if (key === 'End') return length - 1
  return null
}

// Navegación con flechas para grupos donde solo la opción activa recibe foco con Tab.
// El contenedor solo debe tener las opciones como hijos, en el mismo orden.
export function useRovingSelection<T extends string>(
  options: () => readonly { key: T }[],
  current: () => T,
  select: (key: T) => void,
) {
  const container = ref<HTMLElement | null>(null)

  function onKeydown(event: KeyboardEvent) {
    const keys = options().map((option) => option.key)
    const target = nextIndex(event.key, keys.indexOf(current()), keys.length)
    if (target === null) return

    event.preventDefault()
    select(keys[target]!)
    // Se enfoca por posición: la selección puede tardar en volver, por ejemplo si pasa por la URL.
    ;(container.value?.children[target] as HTMLElement | undefined)?.focus()
  }

  return { container, onKeydown }
}
