<script setup lang="ts">
import type { TicketStatus } from '@/types/ticket'

withDefaults(
  defineProps<{
    status: TicketStatus
    size?: 'sm' | 'md'
  }>(),
  { size: 'sm' },
)

const TONES: Record<TicketStatus, string> = {
  Abierto: 'open',
  'En atención': 'progress',
  Resuelto: 'resolved',
}
</script>

<template>
  <span class="status" :class="[`status--${TONES[status]}`, `status--${size}`]">
    {{ status }}
  </span>
</template>

<style scoped>
.status {
  display: inline-block;
  border: 1px solid transparent;
  border-radius: var(--radius-4);
  font-size: var(--font-size-12);
  white-space: nowrap;
}

.status--open {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text);
}

.status--progress {
  background: var(--color-accent-soft);
  border-color: var(--color-accent-soft);
  color: var(--color-accent-hover);
}

.status--resolved {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-text-inverse);
}

.status--sm {
  padding: 2px 8px;
}

.status--md {
  padding: 3px 9px;
}
</style>
