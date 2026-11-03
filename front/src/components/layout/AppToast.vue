<script setup lang="ts">
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { ICONS } from '@/constants/icons'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <!-- La región existe siempre: si apareciera junto con el texto, algunos lectores no lo anuncian. -->
  <div class="toast-region" role="status" aria-live="polite">
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
  right: 24px;
  bottom: 24px;
  z-index: 70;
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
