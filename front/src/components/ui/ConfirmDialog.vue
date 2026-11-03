<script setup lang="ts">
import { onBeforeUnmount, onMounted, useId, useTemplateRef } from 'vue'

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

defineEmits<{ confirm: []; cancel: [] }>()

const titleId = useId()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')

// showModal atrapa el foco, cierra con Escape y devuelve el foco al cerrar.
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <dialog
    ref="dialog"
    class="confirm"
    :class="`confirm--${size}`"
    :aria-labelledby="titleId"
    @cancel.prevent="$emit('cancel')"
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
