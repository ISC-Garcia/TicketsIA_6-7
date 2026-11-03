<script setup lang="ts">
import { computed } from 'vue'

import type { ModelMetrics } from '@/types/model'
import { formatNumber, formatPercent } from '@/utils/chart'

const props = defineProps<{
  metrics: ModelMetrics
}>()

// Nombres de las columnas del dataset tal como se leen en la ficha.
const FEATURE_LABELS: Record<string, string> = {
  area_solicitante: 'área solicitante',
  dispositivo_afectado: 'dispositivo afectado',
  departamento_asignado: 'departamento',
  sentimiento: 'sentimiento',
  descripcion_problema: 'Descripción del problema',
}

// El entrenamiento guarda la fecha en UTC; se muestra en la hora de la mesa de ayuda, como el resto
// de las fechas. El formato sueco da "2026-11-03 06:53".
const trainedAt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Mexico_City',
  dateStyle: 'short',
  timeStyle: 'short',
})

const label = (feature: string) => FEATURE_LABELS[feature] ?? feature

function listOf(items: string[]) {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

const rows = computed(() => {
  const { parameters, context } = props.metrics
  return [
    { label: 'Algoritmo', value: parameters.algorithm },
    { label: 'Árboles', value: formatNumber(parameters.nEstimators) },
    {
      label: 'Balanceo de clases',
      value: parameters.classWeight === 'balanced' ? 'Pesos balanceados por clase' : 'Sin balanceo',
    },
    {
      label: 'Técnica de texto',
      value: `TF-IDF con ${formatNumber(parameters.tfidfMaxFeatures)} términos`,
    },
    {
      label: 'Variables de entrada',
      value: `${label(parameters.textFeature)} (texto vectorizado) y, con One-Hot Encoding: ${listOf(parameters.categoryFeatures.map(label))}`,
    },
    {
      label: 'Departamento y sentimiento',
      value: `Se predicen con ${parameters.contextModel}. Aciertan ${formatPercent(context.department)} el departamento y ${formatPercent(context.sentiment)} el sentimiento.`,
    },
    {
      label: 'Exactitud con el contexto del dataset',
      // Con dos decimales: la diferencia entre ambas es pequeña.
      value: `${formatPercent(props.metrics.accuracyWithDatasetContext, 2)}, frente a ${formatPercent(props.metrics.accuracy, 2)} con el contexto predicho`,
    },
    { label: 'Fecha de entrenamiento', value: trainedAt.format(new Date(props.metrics.trainedAt)) },
    { label: 'Versión de scikit-learn', value: props.metrics.sklearnVersion, mono: true },
    { label: 'Semilla', value: String(parameters.seed), mono: true },
    { label: 'SHA-256 del modelo', value: props.metrics.modelSha256, mono: true },
  ]
})
</script>

<template>
  <div class="sheet">
    <section class="sheet__card">
      <dl class="sheet__list">
        <div v-for="row in rows" :key="row.label" class="sheet__row">
          <dt>{{ row.label }}</dt>
          <dd :class="{ sheet__mono: row.mono }">{{ row.value }}</dd>
        </div>
      </dl>
    </section>

    <section class="sheet__card sheet__notes" aria-labelledby="sheet-dataset">
      <h2 id="sheet-dataset" class="sheet__title">Cómo se construyó el dataset</h2>
      <p>
        El dataset es sintético. El generador fija la prioridad a partir del dispositivo, el
        departamento y el sentimiento, y cambia un 5 % de las etiquetas al azar. Por eso la
        exactitud mide sobre todo qué tan bien el modelo recupera esa regla, y su techo práctico
        ronda el 95 %.
      </p>
      <p>
        El departamento se eligió al azar dentro de dos grupos: tres departamentos para Crítica y
        Alta, y dos para Media y Baja. La descripción no permite distinguirlos, así que el
        departamento que propone el sistema es una sugerencia que el técnico debe confirmar.
      </p>
    </section>
  </div>
</template>

<style scoped>
.sheet {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 860px;
}

.sheet__card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.sheet__list {
  margin: 0;
  padding: 8px 32px;
}

.sheet__row {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-14);
}

.sheet__row:last-child {
  border-bottom: none;
}

.sheet__row dt {
  color: var(--color-text-muted);
}

.sheet__row dd {
  margin: 0;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.sheet__mono {
  font-family: var(--font-mono);
  font-size: var(--font-size-13);
}

.sheet__notes {
  padding: 24px 32px;
  font-size: var(--font-size-14);
  line-height: 1.6;
}

.sheet__title {
  margin: 0 0 8px;
  font-size: var(--font-size-14);
  font-weight: var(--font-weight-semibold);
}

.sheet__notes p {
  margin: 8px 0 0;
  color: var(--color-text-muted);
}
</style>
