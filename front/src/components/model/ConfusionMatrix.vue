<script setup lang="ts">
import { computed } from 'vue'

import type { Priority } from '@/types/ticket'
import { formatNumber, formatPercent } from '@/utils/chart'

const props = defineProps<{
  labels: Priority[]
  matrix: number[][]
}>()

// Sobre este tono la cifra se lee mejor en blanco.
const DARK_FROM = 0.55

const rows = computed(() =>
  props.matrix.map((counts, row) => {
    const sum = counts.reduce((total, count) => total + count, 0)
    return {
      label: props.labels[row]!,
      cells: counts.map((count, column) => {
        const share = sum ? count / sum : 0
        // La raíz cuadrada aclara los errores pequeños sin apagar la diagonal.
        const tone = Math.sqrt(share)
        return {
          key: props.labels[column]!,
          count: formatNumber(count),
          share: formatPercent(share * 100),
          diagonal: row === column,
          dark: tone > DARK_FROM,
          background: `color-mix(in srgb, var(--color-accent) ${(tone * 100).toFixed(1)}%, var(--color-surface))`,
          tooltip: `Real ${props.labels[row]}, predicha ${props.labels[column]}: ${formatNumber(count)}`,
        }
      }),
    }
  }),
)

const total = computed(() => props.matrix.flat().reduce((sum, count) => sum + count, 0))
const correct = computed(() => props.matrix.reduce((sum, counts, index) => sum + counts[index]!, 0))
</script>

<template>
  <section class="matrix">
    <div class="matrix__chart">
      <span class="matrix__axis matrix__axis--x" aria-hidden="true">Prioridad predicha</span>
      <span class="matrix__axis matrix__axis--y" aria-hidden="true">Prioridad real</span>
      <table class="matrix__table">
        <caption class="matrix__hidden">
          Matriz de confusión: prioridad real por fila y predicha por columna
        </caption>
        <thead>
          <tr>
            <td />
            <th v-for="label in labels" :key="label" scope="col" class="matrix__head">
              {{ label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.label">
            <th scope="row" class="matrix__head matrix__head--row">{{ row.label }}</th>
            <td
              v-for="cell in row.cells"
              :key="cell.key"
              class="matrix__cell"
              :class="{ 'matrix__cell--dark': cell.dark, 'matrix__cell--diagonal': cell.diagonal }"
              :style="{ background: cell.background }"
              :title="cell.tooltip"
            >
              <span class="matrix__count">{{ cell.count }}</span>
              <span class="matrix__share">{{ cell.share }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="matrix__legend">
      <p>
        Cada celda indica cuántos tickets de una prioridad real recibieron cada predicción. El
        porcentaje es relativo al total de la fila.
      </p>
      <p class="matrix__diagonal">
        <span class="matrix__swatch" aria-hidden="true" />
        Diagonal: predicciones correctas, {{ formatNumber(correct) }} de {{ formatNumber(total) }}
      </p>
      <div>
        <div class="matrix__scale"><span>0 %</span><span>100 % de la fila</span></div>
        <div class="matrix__gradient" aria-hidden="true" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.matrix {
  display: flex;
  align-items: flex-start;
  gap: 48px;
  max-width: 1040px;
  padding: 28px 32px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.matrix__chart {
  display: grid;
  grid-template-columns: 24px auto;
  grid-template-rows: auto auto;
  column-gap: 8px;
}

.matrix__axis {
  color: var(--color-text);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-semibold);
}

.matrix__axis--x {
  grid-column: 2;
  margin-bottom: 10px;
  padding-left: 98px;
  text-align: center;
}

.matrix__axis--y {
  grid-row: 2;
  align-self: center;
  padding-top: 30px;
  transform: rotate(180deg);
  writing-mode: vertical-rl;
}

.matrix__table {
  grid-column: 2;
  grid-row: 2;
  border-collapse: separate;
  border-spacing: 6px;
  margin: -6px;
  font-variant-numeric: tabular-nums;
}

.matrix__head {
  padding: 0 0 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-regular);
  text-align: center;
}

.matrix__head--row {
  width: 90px;
  padding: 0 8px 0 0;
  text-align: right;
}

.matrix__cell {
  width: 108px;
  height: 76px;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-4);
  color: var(--color-text);
  text-align: center;
}

.matrix__cell--dark {
  border-color: transparent;
  color: var(--color-text-inverse);
}

.matrix__cell--diagonal {
  box-shadow:
    0 0 0 2px var(--color-surface),
    0 0 0 3.5px var(--color-text);
}

.matrix__count {
  display: block;
  font-size: var(--font-size-16);
  font-weight: var(--font-weight-semibold);
}

.matrix__share {
  display: block;
  margin-top: 2px;
  font-size: var(--font-size-11);
  opacity: 0.85;
}

.matrix__legend {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 280px;
  padding-top: 28px;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
  line-height: 1.6;
}

.matrix__legend p {
  margin: 0;
}

.matrix__diagonal {
  display: flex;
  align-items: center;
  gap: 10px;
}

.matrix__swatch {
  width: 18px;
  height: 18px;
  flex: none;
  background: var(--color-accent);
  border-radius: var(--radius-3);
  box-shadow:
    0 0 0 2px var(--color-surface),
    0 0 0 3.5px var(--color-text);
}

.matrix__scale {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: var(--font-size-11);
}

.matrix__gradient {
  height: 8px;
  background: linear-gradient(90deg, var(--color-surface), var(--color-accent));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2);
}

.matrix__hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
