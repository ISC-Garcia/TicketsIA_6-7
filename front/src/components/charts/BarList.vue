<script setup lang="ts">
import { computed } from 'vue'

import { formatNumber } from '@/utils/chart'

export interface BarItem {
  label: string
  value: number
  color: string
  // Texto secundario junto al valor, como el porcentaje.
  note?: string
}

const props = withDefaults(
  defineProps<{
    items: BarItem[]
    label: string
    labelWidth?: number
    barHeight?: number
  }>(),
  { labelWidth: 64, barHeight: 14 },
)

const highest = computed(() => Math.max(1, ...props.items.map((item) => item.value)))
const summary = computed(
  () =>
    `${props.label}: ` +
    props.items.map((item) => `${item.label} ${formatNumber(item.value)}`).join(', '),
)
</script>

<template>
  <ul class="bars" role="img" :aria-label="summary" :style="{ '--label-width': `${labelWidth}px` }">
    <li v-for="item in items" :key="item.label" class="bars__row" aria-hidden="true">
      <span class="bars__label" :title="item.label">{{ item.label }}</span>
      <span class="bars__track">
        <span
          class="bars__bar"
          :style="{
            width: `calc((100% - 120px) * ${item.value / highest})`,
            height: `${barHeight}px`,
            background: item.color,
          }"
        />
        <span class="bars__value">
          {{ formatNumber(item.value) }}
          <span v-if="item.note" class="bars__note">{{ item.note }}</span>
        </span>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bars__row {
  display: grid;
  grid-template-columns: var(--label-width) 1fr;
  gap: 12px;
  align-items: center;
  font-size: var(--font-size-13);
}

.bars__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bars__track {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.bars__bar {
  flex: none;
  min-width: 2px;
  border-radius: var(--radius-2);
}

.bars__value {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.bars__note {
  color: var(--color-text-muted);
}
</style>
