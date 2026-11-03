<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from 'vue'

import BaseIcon from '@/components/ui/BaseIcon.vue'
import { ICONS } from '@/constants/icons'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const region = useTemplateRef<HTMLElement>('region')

// Los diálogos modales viven en la capa superior del navegador y taparían el aviso. La región
// es un popover manual que se vuelve a mostrar con cada aviso: así queda encima del último
// diálogo abierto. jsdom y navegadores viejos no tienen popover; ahí queda como antes.
function bringToFront() {
  const element = region.value
  if (!element || typeof element.showPopover !== 'function') return
  if (element.matches(':popover-open')) element.hidePopover()
  element.showPopover()
}

onMounted(bringToFront)
watch(() => toast.current?.id, bringToFront, { flush: 'post' })
</script>

<template>
  <!-- La región existe siempre: si apareciera junto con el texto, algunos lectores no lo anuncian. -->
  <div ref="region" class="toast-region" role="status" aria-live="polite" popover="manual">
    <div v-if="toast.current" :key="toast.current.id" class="toast">
      <div class="toast__text">
        <p class="toast__message">{{ toast.current.message }}</p>
        <p v-if="toast.current.detail" class="toast__detail">{{ toast.current.detail }}</p>
      </div>
      <button
        type="button"
        class="toast__close"
        aria-label="Cerrar notificación"
        @click="toast.close()"
      >
        <BaseIcon :path="ICONS.close" :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast-region {
  position: fixed;
  inset: auto 24px 24px auto;
  z-index: 70;
  margin: 0;
  padding: 0;
  overflow: visible;
  background: none;
  border: none;
}

/* Sin abrirse como popover (jsdom o navegadores sin soporte) la región se sigue viendo. */
.toast-region:not(:popover-open) {
  display: block;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-width: 280px;
  max-width: 400px;
  padding: 12px 16px;
  background: var(--color-surface-inverse);
  border-radius: var(--radius-6);
  color: var(--color-text-inverse);
  animation: toastIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.toast__text {
  flex: 1;
  min-width: 0;
}

.toast__message {
  margin: 0;
  font-size: var(--font-size-14);
  font-weight: var(--font-weight-medium);
}

.toast__detail {
  margin: 2px 0 0;
  color: var(--color-text-inverse-muted);
  font-size: var(--font-size-12);
}

.toast__close {
  display: flex;
  padding: 2px;
  background: none;
  border: none;
  color: var(--color-text-inverse-muted);
  cursor: pointer;
}
</style>
