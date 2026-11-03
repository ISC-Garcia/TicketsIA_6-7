<script setup lang="ts">
import { computed } from 'vue'

import type { ResolutionVsSla } from '@/types/dashboard'
import { gridValues, niceMax } from '@/utils/chart'

const props = defineProps<{
  rows: ResolutionVsSla[]
}>()

const PARTS = 4

const max = computed(() =>
  niceMax(
    Math.max(1, ...props.rows.flatMap((row) => [row.averageHours ?? 0, row.slaHours])),
    PARTS,
  ),
)
const grid = computed(() => gridValues(max.value, PARTS))
const percent = (value: number) => `${(value / max.value) * 100}%`
const late = (row: ResolutionVsSla) => (row.averageHours ?? 0) > row.slaHours
const hours = (row: ResolutionVsSla) =>
  row.averageHours === null ? 'Sin datos' : `${row.averageHours.toFixed(1)} h`

const summary = computed(() =>
  props.rows
    .map((row) => `${row.priority}: ${hours(row)} contra un SLA de ${row.slaHours} h`)
    .join('; '),
)
</script>

<template>
  <div class="sla" role="img" :aria-label="`Tiempo promedio contra SLA. ${summary}`">
    <div class="sla__plot" aria-hidden="true">
      <template v-for="value in grid" :key="value">
        <div class="sla__grid" :style="{ bottom: percent(value) }" />
        <span class="sla__axis" :style="{ bottom: percent(value) }">{{ value }}</span>
      </template>
      <div class="sla__columns">
        <div v-for="row in rows" :key="row.priority" class="sla__column">
          <div
            class="sla__bar"
            :class="{ 'sla__bar--late': late(row) }"
            :style="{ height: percent(row.averageHours ?? 0) }"
          />
          <div
            class="sla__value"
            :class="{ 'sla__value--late': late(row) }"
            :style="{ bottom: percent(row.averageHours ?? 0) }"
          >
            {{ hours(row) }}
          </div>
          <div class="sla__limit" :style="{ bottom: percent(row.slaHours) }" />
          <div class="sla__limit-label" :style="{ bottom: percent(row.slaHours) }">
            SLA {{ row.slaHours }} h
          </div>
        </div>
      </div>
    </div>
    <div class="sla__labels" aria-hidden="true">
      <span v-for="row in rows" :key="row.priority">{{ row.priority }}</span>
    </div>
  </div>
</template>

<style scoped>
.sla__plot {
  position: relative;
  height: 160px;
  margin-left: 28px;
  border-bottom: 1px solid var(--color-border);
}

.sla__grid {
  position: absolute;
  right: 0;
  left: 0;
  border-top: 1px solid var(--color-fill);
}

.sla__axis {
  position: absolute;
  left: -28px;
  transform: translateY(50%);
  /* Gris con contraste AA sobre blanco: las cifras del eje también se leen. */
  color: var(--color-text-muted);
  font-size: var(--font-size-11);
  font-variant-numeric: tabular-nums;
}

.sla__columns {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}

.sla__column {
  position: relative;
}

.sla__bar {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 40px;
  transform: translateX(-50%);
  border-radius: var(--radius-2) var(--radius-2) 0 0;
  background: var(--color-chart-2);
}

.sla__bar--late {
  background: var(--color-danger);
}

.sla__value {
  position: absolute;
  left: 50%;
  margin-bottom: 4px;
  transform: translateX(-50%);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.sla__value--late {
  color: var(--color-danger);
}

.sla__limit {
  position: absolute;
  left: 50%;
  width: 64px;
  transform: translateX(-50%);
  border-top: 2px solid var(--color-text);
}

.sla__limit-label {
  position: absolute;
  left: calc(50% + 36px);
  transform: translateY(50%);
  color: var(--color-text-muted);
  font-size: var(--font-size-11);
  white-space: nowrap;
}

.sla__labels {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 8px 0 0 28px;
  font-size: var(--font-size-12);
  text-align: center;
}
</style>
