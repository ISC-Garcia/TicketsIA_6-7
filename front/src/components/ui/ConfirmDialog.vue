<script setup lang="ts">
import { useId, useTemplateRef } from 'vue'

import { useModalDialog } from '@/composables/useModalDialog'

import BaseButton from './BaseButton.vue'

withDefaults(
  defineProps<{
    title: string
    body?: string
    confirmLabel: string
    danger?: boolean
    size?: 'sm' | 'md'
  }>(),
  { danger: false, size: 'sm' },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const titleId = useId()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
// Como en el prototipo, la confirmación no se cierra con un clic en el fondo.
const { onCancel } = useModalDialog(dialog, () => emit('cancel'))
</script>

<template>
  <dialog
    ref="dialog"
    class="confirm"
    :class="`confirm--${size}`"
    :aria-labelledby="titleId"
    @cancel="onCancel"
  >
    <h2 :id="titleId" class="confirm__title">{{ title }}</h2>
    <p v-if="body" class="confirm__body">{{ body }}</p>
    <div class="confirm__actions">
      <BaseButton variant="secondary" @click="$emit('cancel')">Cancelar</BaseButton>
      <BaseButton :variant="danger ? 'danger' : 'primary'" @click="$emit('confirm')">
        {{ confirmLabel }}
      </BaseButton>
    </div>
  </dialog>
</template>

<style scoped>
.confirm {
  padding: 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  color: var(--color-text);
}

.confirm::backdrop {
  background: var(--color-scrim-strong);
}

.confirm--sm {
  width: 400px;
}

.confirm--md {
  width: 440px;
}

.confirm__title {
  margin: 0;
  font-size: var(--font-size-16);
  font-weight: var(--font-weight-semibold);
}

.confirm__body {
  margin: 8px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-14);
  line-height: 1.55;
}

.confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}
</style>
