<script setup lang="ts">
import { computed } from 'vue'

import { formatNumber, gridValues, niceMax } from '@/utils/chart'

const props = defineProps<{
  labels: string[]
  created: number[]
  resolved: number[]
}>()

const PARTS = 3
// Separación mínima, en px, entre las etiquetas finales para que no se encimen.
const LABEL_GAP = 18
const HEIGHT = 160

const max = computed(() => niceMax(Math.max(1, ...props.created, ...props.resolved), PARTS, 1.15))
const grid = computed(() => gridValues(max.value, PARTS))
const x = (index: number) =>
  props.labels.length === 1 ? 50 : (index / (props.labels.length - 1)) * 100
const y = (value: number) => 100 - (value / max.value) * 100
const points = (values: number[]) =>
  values.map((value, index) => `${x(index).toFixed(2)},${y(value).toFixed(2)}`).join(' ')

// Las etiquetas "Creados" y "Resueltos" van al final de cada línea, separadas si coinciden.
const ends = computed(() => {
  const last = props.labels.length - 1
  let created = (y(props.created[last] ?? 0) / 100) * HEIGHT
  let resolved = (y(props.resolved[last] ?? 0) / 100) * HEIGHT
  if (Math.abs(created - resolved) < LABEL_GAP) {
    const middle = (created + resolved) / 2
    const createdAbove = created <= resolved
    created = middle + (createdAbove ? -1 : 1) * (LABEL_GAP / 2)
    resolved = middle + (createdAbove ? 1 : -1) * (LABEL_GAP / 2)
  }
  return {
    created: { top: `${created}px`, value: props.created[last] ?? 0 },
    resolved: { top: `${resolved}px`, value: props.resolved[last] ?? 0 },
  }
})

const summary = computed(() =>
  props.labels
    .map(
      (label, index) =>
        `${label}: ${formatNumber(props.created[index] ?? 0)} creados y ${formatNumber(props.resolved[index] ?? 0)} resueltos`,
    )
    .join('; '),
)
</script>

<template>
  <div class="trend" role="img" :aria-label="`Tendencia. ${summary}`">
    <div class="trend__plot" :style="{ height: `${HEIGHT}px` }" aria-hidden="true">
      <template v-for="value in grid" :key="value">
        <div class="trend__grid" :style="{ top: `${y(value)}%` }" />
        <span class="trend__axis" :style="{ top: `${y(value)}%` }">{{ formatNumber(value) }}</span>
      </template>
      <svg class="trend__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline :points="points(resolved)" class="trend__line trend__line--resolved" />
        <polyline :points="points(created)" class="trend__line trend__line--created" />
      </svg>
      <span class="trend__end trend__end--created" :style="{ top: ends.created.top }">
        Creados {{ formatNumber(ends.created.value) }}
      </span>
      <span class="trend__end trend__end--resolved" :style="{ top: ends.resolved.top }">
        Resueltos {{ formatNumber(ends.resolved.value) }}
      </span>
      <span
        v-for="(label, index) in labels"
        :key="label"
        class="trend__label"
        :style="{ left: `${x(index)}%` }"
      >
        {{ label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.trend {
  padding-bottom: 26px;
}

.trend__plot {
  position: relative;
  margin: 0 96px 0 48px;
}

.trend__grid {
  position: absolute;
  right: 0;
  left: 0;
  border-top: 1px solid var(--color-fill);
}

.trend__axis {
  position: absolute;
  left: -48px;
  width: 40px;
  transform: translateY(-50%);
  text-align: right;
  /* Gris con contraste AA sobre blanco: las cifras del eje también se leen. */
  color: var(--color-text-muted);
  font-size: var(--font-size-11);
  font-variant-numeric: tabular-nums;
}

.trend__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.trend__line {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.trend__line--created {
  stroke: var(--color-chart-1);
}

.trend__line--resolved {
  stroke: var(--color-chart-4);
}

.trend__end {
  position: absolute;
  left: 100%;
  padding-left: 10px;
  transform: translateY(-50%);
  font-size: var(--font-size-12);
  white-space: nowrap;
}

.trend__end--created {
  color: var(--color-chart-1);
  font-weight: var(--font-weight-medium);
}

.trend__end--resolved {
  color: var(--color-chart-2);
}

.trend__label {
  position: absolute;
  top: 100%;
  margin-top: 8px;
  transform: translateX(-50%);
  color: var(--color-text-muted);
  font-size: var(--font-size-11);
  white-space: nowrap;
}
</style>
