<script setup lang="ts">
import { computed } from 'vue'

import type { ModelMetrics } from '@/types/model'
import { PRIORITIES, type Priority } from '@/types/ticket'
import { formatNumber, formatPercent } from '@/utils/chart'

const props = defineProps<{
  metrics: ModelMetrics
}>()

const PRIORITY_COLORS: Record<Priority, string> = {
  Crítica: 'var(--color-priority-critical)',
  Alta: 'var(--color-priority-high)',
  Media: 'var(--color-priority-medium)',
  Baja: 'var(--color-priority-low)',
}

const clean = computed(() => props.metrics.cleaning.cleanRecords)
const share = (count: number) => (count / clean.value) * 100

const split = computed(() => {
  const { train, validation, test } = props.metrics.split
  return [
    { label: 'Entrenamiento', count: train, tone: 'dark' },
    { label: 'Evaluación', count: validation, tone: 'medium' },
    { label: 'Pruebas', count: test, tone: 'light' },
  ].map((part) => ({
    ...part,
    rounded: Math.round(share(part.count)),
    records: `${formatNumber(part.count)} registros`,
    width: `${share(part.count).toFixed(2)}%`,
  }))
})

const splitSubtitle = computed(
  () =>
    `${formatNumber(clean.value)} registros limpios, ${split.value.map((part) => part.rounded).join(' / ')}`,
)

const distribution = computed(() => {
  const counts = props.metrics.distribution
  const highest = Math.max(...PRIORITIES.map((priority) => counts[priority]))
  return PRIORITIES.map((priority) => ({
    priority,
    count: formatNumber(counts[priority]),
    percent: formatPercent(share(counts[priority])),
    // La barra más larga deja 120 px para la cifra.
    width: `calc((100% - 120px) * ${(counts[priority] / highest).toFixed(4)})`,
    color: PRIORITY_COLORS[priority],
  }))
})

// Las fechas corruptas se cuentan sobre el dataset bruto; algunas estaban en filas duplicadas.
// Aquí se muestran las que se eliminaron después de quitar duplicados, para que la resta cuadre.
const steps = computed(() => {
  const { rawRecords, duplicates, cleanRecords } = props.metrics.cleaning
  return [
    { label: 'Registros brutos', value: formatNumber(rawRecords), kind: 'start' },
    { label: 'Duplicados eliminados', value: `−${formatNumber(duplicates)}`, kind: 'removed' },
    {
      label: 'Fechas corruptas eliminadas',
      value: `−${formatNumber(rawRecords - duplicates - cleanRecords)}`,
      kind: 'removed',
    },
    { label: 'Registros limpios', value: formatNumber(cleanRecords), kind: 'end' },
  ]
})

const imputed = computed(() => {
  const { missingDevices, missingHours, outlierHours } = props.metrics.cleaning
  return [
    { label: 'Dispositivos vacíos, marcados como "Sin Especificar"', value: missingDevices },
    { label: 'Tiempos vacíos, completados con la mediana de su prioridad', value: missingHours },
    { label: 'Tiempos negativos o mayores de 120 h, tratados como vacíos', value: outlierHours },
  ]
})
</script>

<template>
  <div class="data">
    <section class="data__card" aria-labelledby="data-split">
      <h2 id="data-split" class="data__title">División del dataset</h2>
      <p class="data__subtitle">{{ splitSubtitle }}</p>
      <div class="data__split">
        <div
          v-for="part in split"
          :key="part.label"
          class="data__split-part"
          :class="`data__split-part--${part.tone}`"
          :style="{ width: part.width }"
        >
          {{ part.rounded }} %
        </div>
      </div>
      <dl class="data__split-labels">
        <div v-for="part in split" :key="part.label" :style="{ width: part.width }">
          <dt>{{ part.label }}</dt>
          <dd>{{ part.records }}</dd>
        </div>
      </dl>
    </section>

    <div class="data__grid">
      <section class="data__card" aria-labelledby="data-distribution">
        <h2 id="data-distribution" class="data__title data__title--spaced">
          Distribución por prioridad
        </h2>
        <ul class="data__bars">
          <li v-for="bar in distribution" :key="bar.priority" class="data__bar-row">
            <span>{{ bar.priority }}</span>
            <span class="data__bar-value">
              <span class="data__bar" :style="{ width: bar.width, background: bar.color }" />
              {{ bar.count }} <span class="data__muted">{{ bar.percent }}</span>
            </span>
          </li>
        </ul>
      </section>

      <section class="data__card" aria-labelledby="data-cleaning">
        <h2 id="data-cleaning" class="data__title data__title--spaced">Proceso de limpieza</h2>
        <ol class="data__steps">
          <li
            v-for="step in steps"
            :key="step.label"
            class="data__step"
            :class="`data__step--${step.kind}`"
          >
            <span class="data__dot" aria-hidden="true" />
            <span class="data__step-label">{{ step.label }}</span>
            <span class="data__step-value">{{ step.value }}</span>
          </li>
        </ol>
        <h3 class="data__imputed-title">Corregidos sin eliminar</h3>
        <ul class="data__imputed">
          <li v-for="item in imputed" :key="item.label">
            <span>{{ item.label }}</span>
            <span class="data__imputed-value">{{ formatNumber(item.value) }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.data {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1040px;
}

.data__card {
  padding: 24px 28px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.data__title {
  margin: 0;
  font-size: var(--font-size-14);
  font-weight: var(--font-weight-semibold);
}

.data__title--spaced {
  margin-bottom: 18px;
}

.data__subtitle {
  margin: 2px 0 16px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.data__split {
  display: flex;
  gap: 2px;
  height: 44px;
  overflow: hidden;
  border-radius: var(--radius-4);
}

.data__split-part {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0 12px;
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.data__split-part--dark {
  background: var(--color-chart-1);
  color: var(--color-text-inverse);
}

.data__split-part--medium {
  background: var(--color-chart-2);
  color: var(--color-text-inverse);
}

.data__split-part--light {
  background: var(--color-chart-4);
  color: var(--color-text);
}

.data__split-labels {
  display: flex;
  gap: 2px;
  margin: 10px 0 0;
  font-size: var(--font-size-13);
}

.data__split-labels > div {
  min-width: 0;
  padding: 0 2px;
}

.data__split-labels dt {
  font-weight: var(--font-weight-medium);
}

.data__split-labels dd {
  margin: 0;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.data__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
  gap: 16px;
}

.data__bars {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.data__bar-row {
  display: grid;
  grid-template-columns: 60px 1fr;
  gap: 12px;
  align-items: center;
  font-size: var(--font-size-13);
}

.data__bar-value {
  display: flex;
  align-items: center;
  gap: 10px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.data__bar {
  height: 12px;
  flex: none;
  border-radius: var(--radius-2);
}

.data__muted {
  color: var(--color-text-muted);
}

.data__steps {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.data__steps::before {
  content: '';
  position: absolute;
  top: 6px;
  left: 6px;
  right: calc(25% - 6px);
  border-top: 1px solid var(--color-border);
}

.data__step {
  position: relative;
  display: flex;
  flex-direction: column;
  padding-right: 12px;
}

.data__dot {
  width: 13px;
  height: 13px;
  background: var(--color-surface);
  border: 2px solid var(--color-border-strong);
  border-radius: 50%;
}

.data__step--start .data__dot {
  border-color: var(--color-text-muted);
}

.data__step--end .data__dot {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.data__step-label {
  margin-top: 12px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  line-height: 1.4;
}

.data__step-value {
  margin-top: 4px;
  font-size: var(--font-size-20);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-semibold);
}

.data__step--removed .data__step-value {
  color: var(--color-text-muted);
}

.data__step--end .data__step-value {
  color: var(--color-accent);
}

.data__imputed-title {
  margin: 24px 0 8px;
  font-size: var(--font-size-13);
  font-weight: var(--font-weight-semibold);
}

.data__imputed {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-13);
}

.data__imputed li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-muted);
}

.data__imputed li:last-child {
  border-bottom: none;
}

.data__imputed-value {
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}
</style>
