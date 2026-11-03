<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'muted'
  }>(),
  { tone: 'neutral' },
)
</script>

<template>
  <span class="badge" :class="`badge--${tone}`"><slot /></span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 2px 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-4);
  font-size: var(--font-size-12);
  white-space: nowrap;
}

.badge--neutral {
  background: var(--color-bg);
  border-color: var(--color-border);
  color: var(--color-text);
}

.badge--success {
  background: var(--color-accent-soft);
  border-color: var(--color-accent-border);
  color: var(--color-accent);
  font-weight: var(--font-weight-medium);
}

.badge--warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
  font-weight: var(--font-weight-medium);
}

.badge--danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-weight: var(--font-weight-medium);
}

.badge--muted {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text-subtle);
  font-weight: var(--font-weight-medium);
}
</style>
