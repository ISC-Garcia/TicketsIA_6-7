<script setup lang="ts">
import { computed } from 'vue'

import PriorityBadge from '@/components/ui/PriorityBadge.vue'
import type { ModelMetrics } from '@/types/model'
import { formatNumber, formatPercent } from '@/utils/chart'

const props = defineProps<{
  metrics: ModelMetrics
}>()

// Objetivo de exactitud del proyecto.
const GOAL = 90
// Las barras por clase usan una escala de 80 % a 100 % para que se noten las diferencias.
const SCALE_FROM = 80

const met = computed(() => props.metrics.accuracy > GOAL)

const scaled = (value: number) =>
  `${Math.max(0, ((value - SCALE_FROM) / (100 - SCALE_FROM)) * 100).toFixed(1)}%`

const rows = computed(() =>
  props.metrics.classes.map((row) => ({
    priority: row.priority,
    support: formatNumber(row.support),
    cells: [
      { key: 'precision', value: row.precision, strong: false },
      { key: 'recall', value: row.recall, strong: false },
      { key: 'f1', value: row.f1, strong: true },
    ],
  })),
)
</script>

<template>
  <div class="metrics">
    <section class="metrics__card metrics__accuracy" aria-label="Exactitud general">
      <div>
        <h2 class="metrics__label">Exactitud general</h2>
        <p class="metrics__value">{{ formatPercent(metrics.accuracy) }}</p>
      </div>
      <div class="metrics__goal">
        <p class="metrics__goal-title">
          Objetivo del proyecto: superior a {{ GOAL }} %
          <span class="metrics__badge" :class="{ 'metrics__badge--missed': !met }">
            {{ met ? 'Cumplido' : 'No cumplido' }}
          </span>
        </p>
        <div
          class="metrics__track"
          role="meter"
          aria-label="Exactitud frente al objetivo"
          :aria-valuenow="metrics.accuracy"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="metrics__fill" :style="{ width: `${metrics.accuracy}%` }" />
          <div class="metrics__target" :style="{ left: `${GOAL}%` }" />
        </div>
        <div class="metrics__scale">
          <span>0 %</span>
          <span class="metrics__scale-goal" :style="{ right: `${100 - GOAL}%` }">
            Objetivo {{ GOAL }} %
          </span>
        </div>
      </div>
    </section>

    <section class="metrics__card metrics__table-card">
      <table class="metrics__table">
        <caption class="metrics__hidden">
          Métricas por clase
        </caption>
        <thead>
          <tr>
            <th scope="col">Clase</th>
            <th scope="col">Precisión</th>
            <th scope="col">Recall</th>
            <th scope="col">F1</th>
            <th scope="col" class="metrics__support">Soporte</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.priority">
            <th scope="row"><PriorityBadge :priority="row.priority" /></th>
            <td v-for="cell in row.cells" :key="cell.key">
              <div class="metrics__cell">
                <span class="metrics__number" :class="{ 'metrics__number--strong': cell.strong }">
                  {{ formatPercent(cell.value) }}
                </span>
                <div class="metrics__bar">
                  <div
                    class="metrics__bar-fill"
                    :class="{ 'metrics__bar-fill--strong': cell.strong }"
                    :style="{ width: scaled(cell.value) }"
                  />
                </div>
              </div>
            </td>
            <td class="metrics__support">{{ row.support }}</td>
          </tr>
        </tbody>
      </table>
      <p class="metrics__note">
        Las barras muestran el valor de cada métrica en una escala de {{ SCALE_FROM }} % a 100 %. El
        soporte es el número de tickets reales de la clase en el conjunto de prueba.
      </p>
    </section>
  </div>
</template>

<style scoped>
.metrics {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1040px;
}

.metrics__card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.metrics__accuracy {
  display: flex;
  align-items: center;
  gap: 48px;
  padding: 28px 32px;
}

.metrics__label {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
  font-weight: var(--font-weight-regular);
}

.metrics__value {
  margin: 4px 0 0;
  font-size: var(--font-size-56);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.03em;
  line-height: 1.05;
}

.metrics__goal {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  max-width: 420px;
}

.metrics__goal-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: var(--font-size-14);
}

.metrics__badge {
  padding: 1px 7px;
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-ring);
  border-radius: var(--radius-3);
  color: var(--color-accent);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-semibold);
}

.metrics__badge--missed {
  background: var(--color-danger-soft);
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.metrics__track {
  position: relative;
  height: 8px;
  background: var(--color-fill);
  border-radius: var(--radius-2);
}

.metrics__fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-2);
}

.metrics__target {
  position: absolute;
  top: -5px;
  bottom: -5px;
  border-left: 2px solid var(--color-text);
}

.metrics__scale {
  position: relative;
  height: 14px;
  color: var(--color-text-muted);
  font-size: var(--font-size-11);
}

.metrics__scale-goal {
  position: absolute;
  padding-right: 6px;
  white-space: nowrap;
}

.metrics__table-card {
  overflow: hidden;
}

.metrics__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-13);
  font-variant-numeric: tabular-nums;
}

.metrics__table th,
.metrics__table td {
  padding: 16px 12px;
  border-bottom: 1px solid var(--color-border-subtle);
  font-weight: var(--font-weight-regular);
  text-align: left;
}

.metrics__table th:first-child {
  width: 130px;
  padding-left: 28px;
}

.metrics__table thead th {
  padding-top: 12px;
  padding-bottom: 12px;
  background: var(--color-surface-muted);
  border-bottom-color: var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
}

.metrics__table .metrics__support {
  width: 100px;
  padding-right: 28px;
  color: var(--color-text-muted);
  text-align: right;
}

.metrics__cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.metrics__number {
  width: 52px;
  flex: none;
}

.metrics__number--strong {
  font-weight: var(--font-weight-semibold);
}

.metrics__bar {
  flex: 1;
  height: 3px;
  background: var(--color-fill);
  border-radius: var(--radius-2);
}

.metrics__bar-fill {
  height: 100%;
  background: var(--color-accent-ring);
  border-radius: var(--radius-2);
}

.metrics__bar-fill--strong {
  background: var(--color-accent);
}

.metrics__note {
  margin: 0;
  padding: 12px 28px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.metrics__hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
