<script setup lang="ts">
import { computed } from 'vue'

import { useRovingSelection } from '@/composables/useRovingSelection'
import { PRIORITIES, type Priority } from '@/types/ticket'
import { formatTicketCount } from '@/utils/format'

type Option = Priority | ''

const props = defineProps<{
  counts: Record<Priority, number>
}>()

const model = defineModel<Option>({ required: true })

const DOTS: Record<Priority, string> = {
  Crítica: 'var(--color-priority-critical)',
  Alta: 'var(--color-priority-high)',
  Media: 'var(--color-priority-medium)',
  Baja: 'var(--color-priority-low)',
}

const options = computed(() => [
  {
    key: '' as Option,
    label: 'Todos',
    count: PRIORITIES.reduce((total, priority) => total + props.counts[priority], 0),
    dot: 'var(--color-accent)',
  },
  ...PRIORITIES.map((priority) => ({
    key: priority as Option,
    label: priority,
    count: props.counts[priority],
    dot: DOTS[priority],
  })),
])

const { container, onKeydown } = useRovingSelection(
  () => options.value,
  () => model.value,
  (key) => {
    model.value = key
  },
)
</script>

<template>
  <div
    ref="container"
    role="radiogroup"
    aria-label="Filtrar por prioridad"
    class="priority-filter"
    @keydown="onKeydown"
  >
    <button
      v-for="option in options"
      :key="option.key"
      type="button"
      role="radio"
      class="priority-filter__option"
      :class="{ 'priority-filter__option--active': option.key === model }"
      :aria-checked="option.key === model"
      :tabindex="option.key === model ? 0 : -1"
      :aria-label="`${option.label}, ${formatTicketCount(option.count)}`"
      @click="model = option.key"
    >
      <span class="priority-filter__label">
        <span class="priority-filter__dot" :style="{ background: option.dot }" />
        {{ option.label }}
      </span>
      <span class="priority-filter__count">{{ option.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.priority-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.priority-filter__option {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-6);
  color: var(--color-text);
  font-size: var(--font-size-13);
  cursor: pointer;
}

.priority-filter__option:hover {
  border-color: var(--color-accent-ring);
}

.priority-filter__option--active {
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
  color: var(--color-accent);
  font-weight: var(--font-weight-semibold);
}

.priority-filter__label {
  display: flex;
  align-items: center;
  gap: 7px;
}

.priority-filter__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.priority-filter__count {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-semibold);
}

.priority-filter__option--active .priority-filter__count {
  color: var(--color-accent);
}
</style>
