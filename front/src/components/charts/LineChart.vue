<script setup lang="ts">
import { computed } from 'vue'

import { formatNumber, gridValues, niceMax } from '@/utils/chart'

const props = withDefaults(
  defineProps<{
    labels: string[]
    values: (number | null)[]
    // Nombre de la serie para el lector de pantalla, como "consultas por hora".
    name: string
    tone?: 'dark' | 'light'
  }>(),
  { tone: 'dark' },
)

const PARTS = 2
const HEIGHT = 140
// Cuántas etiquetas del eje X caben sin encimarse.
const MAX_LABELS = 7

const present = computed(() => props.values.filter((value): value is number => value !== null))
const max = computed(() => niceMax(Math.max(1, ...present.value), PARTS, 1.15))
const grid = computed(() => gridValues(max.value, PARTS))
const x = (index: number) =>
  props.labels.length === 1 ? 50 : (index / (props.labels.length - 1)) * 100
const y = (value: number) => 100 - (value / max.value) * 100

// Un tramo sin muestras corta la línea: no se une lo que no se midió.
const segments = computed(() => {
  const result: string[][] = []
  let current: string[] = []
  props.values.forEach((value, index) => {
    if (value === null) {
      if (current.length) result.push(current)
      current = []
      return
    }
    current.push(`${x(index).toFixed(2)},${y(value).toFixed(2)}`)
  })
  if (current.length) result.push(current)
  return result.map((points) => points.join(' '))
})

// Un punto suelto no se ve como línea: se marca con un círculo.
const dots = computed(() =>
  props.values.flatMap((value, index) => {
    const alone =
      value !== null && props.values[index - 1] == null && props.values[index + 1] == null
    return alone ? [{ x: x(index), y: y(value) }] : []
  }),
)

const lastIndex = computed(() =>
  props.values.reduce<number>((last, value, index) => (value === null ? last : index), -1),
)
const end = computed(() =>
  lastIndex.value < 0
    ? null
    : { top: `${y(props.values[lastIndex.value]!)}%`, value: props.values[lastIndex.value]! },
)

const every = computed(() => Math.max(1, Math.ceil(props.labels.length / MAX_LABELS)))
const axisLabels = computed(() =>
  props.labels
    .map((label, index) => ({ label, index }))
    .filter(({ index }) => index % every.value === 0 || index === props.labels.length - 1),
)

const summary = computed(() => {
  if (!present.value.length) return `Sin muestras de ${props.name} en el periodo.`
  return props.labels
    .flatMap((label, index) => {
      const value = props.values[index]
      return value === null || value === undefined ? [] : [`${label}: ${formatNumber(value)}`]
    })
    .join('; ')
})
</script>

<template>
  <div class="line" role="img" :aria-label="`${name}. ${summary}`">
    <p v-if="!present.length" class="line__empty">Aún no hay muestras en este periodo.</p>
    <div class="line__plot" :style="{ height: `${HEIGHT}px` }" aria-hidden="true">
      <template v-for="value in grid" :key="value">
        <div class="line__grid" :style="{ top: `${y(value)}%` }" />
        <span class="line__axis" :style="{ top: `${y(value)}%` }">{{ formatNumber(value) }}</span>
      </template>
      <svg class="line__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          v-for="points in segments"
          :key="points"
          :points="points"
          class="line__path"
          :class="`line__path--${tone}`"
        />
      </svg>
      <span
        v-for="dot in dots"
        :key="dot.x"
        class="line__dot"
        :class="`line__dot--${tone}`"
        :style="{ left: `${dot.x}%`, top: `${dot.y}%` }"
      />
      <span v-if="end" class="line__end" :class="`line__end--${tone}`" :style="{ top: end.top }">
        {{ formatNumber(end.value) }}
      </span>
      <span
        v-for="item in axisLabels"
        :key="item.index"
        class="line__label"
        :style="{ left: `${x(item.index)}%` }"
      >
        {{ item.label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.line {
  position: relative;
  padding-bottom: 24px;
}

.line__empty {
  position: absolute;
  inset: 0 64px 24px 44px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}

.line__plot {
  position: relative;
  margin: 0 64px 0 44px;
}

.line__grid {
  position: absolute;
  right: 0;
  left: 0;
  border-top: 1px solid var(--color-fill);
}

.line__axis {
  position: absolute;
  right: 100%;
  margin-right: 8px;
  /* Gris con contraste AA sobre blanco: las cifras del eje también se leen. */
  color: var(--color-text-muted);
  font-size: var(--font-size-11);
  font-variant-numeric: tabular-nums;
  transform: translateY(-50%);
  white-space: nowrap;
}

.line__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.line__path {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.line__path--dark {
  stroke: var(--color-accent);
}

.line__path--light {
  stroke: var(--color-accent-ring);
}

.line__dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.line__dot--dark {
  background: var(--color-accent);
}

.line__dot--light {
  background: var(--color-accent-ring);
}

.line__end {
  position: absolute;
  left: 100%;
  padding-left: 10px;
  font-size: var(--font-size-12);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-medium);
  transform: translateY(-50%);
  white-space: nowrap;
}

.line__end--dark {
  color: var(--color-accent);
}

.line__end--light {
  color: var(--color-chart-2);
}

.line__label {
  position: absolute;
  top: 100%;
  margin-top: 8px;
  color: var(--color-text-muted);
  font-size: var(--font-size-11);
  transform: translateX(-50%);
  white-space: nowrap;
}
</style>
