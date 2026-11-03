<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'

import BaseIcon from '@/components/ui/BaseIcon.vue'
import { ICONS } from '@/constants/icons'

const props = defineProps<{
  ticketId: string
}>()

const emit = defineEmits<{ reassign: [] }>()

const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const firstItem = useTemplateRef<HTMLButtonElement>('firstItem')

function close(returnFocus = false) {
  open.value = false
  if (returnFocus) trigger.value?.focus()
}

// Un clic fuera del menú lo cierra, como en el prototipo.
function onDocumentPointerdown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) close()
}

watch(open, async (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', onDocumentPointerdown)
    await nextTick()
    firstItem.value?.focus()
  } else {
    document.removeEventListener('pointerdown', onDocumentPointerdown)
  }
})

onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerdown))

function reassign() {
  close()
  emit('reassign')
}
</script>

<template>
  <div ref="root" class="actions" @keydown.escape.stop="close(true)">
    <button
      ref="trigger"
      type="button"
      class="actions__trigger"
      :class="{ 'actions__trigger--open': open }"
      :aria-label="`Acciones de ${props.ticketId}`"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <BaseIcon :path="ICONS.more" :size="16" />
    </button>
    <div
      v-if="open"
      role="menu"
      class="actions__menu"
      :aria-label="`Acciones de ${props.ticketId}`"
    >
      <button ref="firstItem" type="button" role="menuitem" class="actions__item" @click="reassign">
        Reasignar
      </button>
    </div>
  </div>
</template>

<style scoped>
.actions {
  position: relative;
  display: flex;
  justify-content: flex-end;
}

.actions__trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-6);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.actions__trigger:hover,
.actions__trigger--open {
  border-color: var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}

.actions__menu {
  position: absolute;
  top: 36px;
  right: 0;
  z-index: 32;
  min-width: 160px;
  padding: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-6);
  box-shadow: var(--shadow-menu);
}

.actions__item {
  display: flex;
  align-items: center;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: none;
  border-radius: var(--radius-4);
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-13);
  text-align: left;
  cursor: pointer;
}

.actions__item:hover,
.actions__item:focus-visible {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}
</style>
