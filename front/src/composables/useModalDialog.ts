import { onBeforeUnmount, onMounted, type TemplateRef } from 'vue'

// showModal atrapa el foco y deja inerte el resto de la página. Al cerrar,
// el navegador devuelve el foco al elemento que abrió el diálogo.
export function useModalDialog(dialog: TemplateRef<HTMLDialogElement>, dismiss: () => void) {
  onMounted(() => dialog.value?.showModal())
  onBeforeUnmount(() => dialog.value?.close())

  // El clic solo cuenta como fuera si empezó y terminó en el fondo, para no
  // cerrar al arrastrar una selección de texto hacia afuera.
  let pressedOnBackdrop = false

  return {
    onCancel(event: Event) {
      event.preventDefault()
      dismiss()
    },
    onPointerdown(event: PointerEvent) {
      pressedOnBackdrop = event.target === event.currentTarget
    },
    onClick(event: MouseEvent) {
      if (pressedOnBackdrop && event.target === event.currentTarget) dismiss()
      pressedOnBackdrop = false
    },
  }
}
