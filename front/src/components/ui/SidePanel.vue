<script setup lang="ts">
import { useId, useTemplateRef } from 'vue'

import { useModalDialog } from '@/composables/useModalDialog'
import { ICONS } from '@/constants/icons'

import BaseIcon from './BaseIcon.vue'

defineProps<{
  title: string
  subtitle?: string
}>()

const emit = defineEmits<{ close: [] }>()

const titleId = useId()
const subtitleId = useId()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const { onCancel, onPointerdown, onClick } = useModalDialog(dialog, () => emit('close'))
</script>

<template>
  <dialog
    ref="dialog"
    class="panel"
    :aria-labelledby="titleId"
    :aria-describedby="subtitle ? subtitleId : undefined"
    @cancel="onCancel"
    @pointerdown="onPointerdown"
    @click="onClick"
  >
    <div class="panel__frame">
      <header class="panel__header">
        <div>
          <h2 :id="titleId" class="panel__title">{{ title }}</h2>
          <p v-if="subtitle" :id="subtitleId" class="panel__subtitle">{{ subtitle }}</p>
        </div>
        <button
          type="button"
          class="panel__close"
          aria-label="Cerrar"
          title="Cerrar"
          @click="$emit('close')"
        >
          <BaseIcon :path="ICONS.close" :size="16" />
        </button>
      </header>
      <div class="panel__body">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="panel__footer">
        <slot name="footer" />
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.panel {
  inset: 0 0 0 auto;
  width: 480px;
  max-width: none;
  height: 100%;
  max-height: none;
  margin: 0;
  padding: 0;
  background: var(--color-surface);
  border: none;
  border-left: 1px solid var(--color-border);
  color: var(--color-text);
  animation: drawerIn 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.panel::backdrop {
  background: var(--color-scrim);
  animation: fadeIn 0.2s ease;
}

.panel__frame {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 20px 28px;
  border-bottom: 1px solid var(--color-border);
}

.panel__title {
  margin: 0;
  font-size: var(--font-size-17);
  font-weight: var(--font-weight-semibold);
}

.panel__subtitle {
  margin: 3px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}

.panel__close {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-6);
  color: var(--color-text-muted);
  cursor: pointer;
}

.panel__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  padding: 24px 28px;
  overflow: auto;
}

.panel__footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  padding: 16px 28px;
  border-top: 1px solid var(--color-border);
}
</style>
