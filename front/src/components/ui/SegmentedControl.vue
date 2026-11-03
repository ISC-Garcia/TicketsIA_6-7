<script setup lang="ts" generic="T extends string">
import { useRovingSelection } from '@/composables/useRovingSelection'

const props = withDefaults(
  defineProps<{
    options: readonly { key: T; label: string }[]
    label: string
    size?: 'md' | 'sm'
  }>(),
  { size: 'md' },
)

const model = defineModel<T>({ required: true })

const { container, onKeydown } = useRovingSelection(
  () => props.options,
  () => model.value,
  (key) => {
    model.value = key
  },
)
</script>

<template>
  <div ref="container" role="radiogroup" :aria-label="label" class="segmented" @keydown="onKeydown">
    <button
      v-for="option in options"
      :key="option.key"
      type="button"
      role="radio"
      class="segmented__option"
      :class="[`segmented__option--${size}`, { 'segmented__option--active': option.key === model }]"
      :aria-checked="option.key === model"
      :tabindex="option.key === model ? 0 : -1"
      @click="model = option.key"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  flex: none;
  gap: 2px;
  padding: 3px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-6);
}

.segmented__option {
  padding: 0 12px;
  background: transparent;
  border: none;
  border-radius: var(--radius-4);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--font-size-13);
  white-space: nowrap;
}

.segmented__option--md {
  height: 30px;
}

.segmented__option--sm {
  height: 28px;
}

.segmented__option--active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-weight: var(--font-weight-semibold);
}
</style>
