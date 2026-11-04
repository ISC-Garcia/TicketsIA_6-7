<script setup lang="ts">
import type { FieldChange } from '@/types/event'

withDefaults(
  defineProps<{
    change: FieldChange
    afterClose?: boolean
  }>(),
  { afterClose: false },
)
</script>

<template>
  <div class="change">
    <div class="change__field">{{ change.field }}</div>
    <div class="change__values" :class="{ 'change__values--after-close': afterClose }">
      <div class="change__value">
        <div class="change__label">Valor anterior</div>
        <div class="change__text">{{ change.oldValue }}</div>
      </div>
      <div class="change__value">
        <div class="change__label">Valor nuevo</div>
        <div class="change__text change__text--new">{{ change.newValue }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.change {
  max-width: 520px;
}

.change__field {
  margin-bottom: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.change__values {
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-6);
}

.change__values--after-close {
  border-color: var(--color-warning-border);
}

.change__value {
  padding: 8px 12px;
  background: var(--color-surface);
}

.change__value:first-child {
  border-right: 1px solid var(--color-border);
}

.change__values--after-close .change__value:first-child {
  border-right-color: var(--color-warning-border);
}

.change__label {
  color: var(--color-text-muted);
  font-size: var(--font-size-11);
}

.change__text {
  margin-top: 2px;
  font-size: var(--font-size-13);
}

.change__text--new {
  font-weight: var(--font-weight-medium);
}

.change__values--after-close .change__text--new {
  color: var(--color-warning);
}
</style>
