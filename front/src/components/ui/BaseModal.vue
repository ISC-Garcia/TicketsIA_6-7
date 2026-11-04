<script setup lang="ts">
import { useId, useTemplateRef } from 'vue'

import { useModalDialog } from '@/composables/useModalDialog'

withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    size?: 'sm' | 'md'
  }>(),
  { size: 'sm' },
)

const emit = defineEmits<{ close: [] }>()

const titleId = useId()
const subtitleId = useId()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const { onCancel, onPointerdown, onClick } = useModalDialog(dialog, () => emit('close'))
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    :class="`modal--${size}`"
    :aria-labelledby="titleId"
    :aria-describedby="subtitle ? subtitleId : undefined"
    @cancel="onCancel"
    @pointerdown="onPointerdown"
    @click="onClick"
  >
    <div class="modal__frame">
      <header class="modal__header">
        <h2 :id="titleId" class="modal__title">{{ title }}</h2>
        <p v-if="subtitle" :id="subtitleId" class="modal__subtitle">{{ subtitle }}</p>
      </header>
      <div class="modal__body">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="modal__footer">
        <slot name="footer" />
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.modal {
  padding: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  color: var(--color-text);
  animation: fadeIn 0.16s ease;
}

.modal::backdrop {
  background: var(--color-scrim-strong);
  animation: fadeIn 0.16s ease;
}

.modal--sm {
  width: 400px;
}

.modal--md {
  width: 440px;
}

.modal__header {
  padding: 20px 24px 4px;
}

.modal__title {
  margin: 0;
  font-size: var(--font-size-16);
  font-weight: var(--font-weight-semibold);
}

.modal__subtitle {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}

.modal__body {
  padding: 16px 24px;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 24px 20px;
}
</style>
