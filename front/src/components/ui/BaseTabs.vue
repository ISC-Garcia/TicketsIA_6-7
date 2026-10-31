<script setup lang="ts" generic="T extends string">
import { useId } from 'vue'

import { useRovingSelection } from '@/composables/useRovingSelection'

const props = defineProps<{
  tabs: readonly { key: T; label: string }[]
  label: string
}>()

const model = defineModel<T>({ required: true })

const baseId = useId()
const { container, onKeydown } = useRovingSelection(
  () => props.tabs,
  () => model.value,
  (key) => {
    model.value = key
  },
)
</script>

<template>
  <div ref="container" role="tablist" :aria-label="label" class="tabs" @keydown="onKeydown">
    <button
      v-for="tab in tabs"
      :id="`${baseId}-tab-${tab.key}`"
      :key="tab.key"
      type="button"
      role="tab"
      class="tabs__tab"
      :class="{ 'tabs__tab--active': tab.key === model }"
      :aria-selected="tab.key === model"
      :aria-controls="`${baseId}-panel`"
      :tabindex="tab.key === model ? 0 : -1"
      @click="model = tab.key"
    >
      {{ tab.label }}
    </button>
  </div>
  <div :id="`${baseId}-panel`" role="tabpanel" :aria-labelledby="`${baseId}-tab-${model}`">
    <slot :active="model" />
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 28px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--color-border);
}

.tabs__tab {
  margin-bottom: -1px;
  padding: 10px 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--font-size-14);
}

.tabs__tab--active {
  border-bottom-color: var(--color-accent);
  color: var(--color-accent);
  font-weight: var(--font-weight-semibold);
}
</style>
