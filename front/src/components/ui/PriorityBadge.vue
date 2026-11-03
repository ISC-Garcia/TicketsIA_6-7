<script setup lang="ts">
import type { Priority } from '@/types/ticket'

withDefaults(
  defineProps<{
    priority: Priority
    size?: 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { size: 'sm' },
)

const TONES: Record<Priority, string> = {
  Crítica: 'critical',
  Alta: 'high',
  Media: 'medium',
  Baja: 'low',
}
</script>

<template>
  <span class="priority" :class="[`priority--${TONES[priority]}`, `priority--${size}`]">
    {{ priority }}
  </span>
</template>

<style scoped>
.priority {
  display: inline-block;
  border-radius: var(--radius-4);
  white-space: nowrap;
}

.priority--critical {
  background: var(--color-priority-critical-bg);
  color: var(--color-priority-critical);
}

.priority--high {
  background: var(--color-priority-high-bg);
  color: var(--color-priority-high);
}

.priority--medium {
  background: var(--color-priority-medium-bg);
  color: var(--color-priority-medium);
}

.priority--low {
  background: var(--color-priority-low-bg);
  color: var(--color-priority-low);
}

.priority--sm {
  padding: 2px 8px;
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
}

.priority--md {
  padding: 3px 9px;
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
}

.priority--lg {
  padding: 4px 12px;
  font-size: var(--font-size-15);
  font-weight: var(--font-weight-semibold);
}

.priority--xl {
  padding: 5px 14px;
  font-size: var(--font-size-18);
  font-weight: var(--font-weight-semibold);
}
</style>
