<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import ConfusionMatrix from '@/components/model/ConfusionMatrix.vue'
import ModelMetricsPanel from '@/components/model/ModelMetricsPanel.vue'
import ModelSheet from '@/components/model/ModelSheet.vue'
import TrainingData from '@/components/model/TrainingData.vue'
import BaseTabs from '@/components/ui/BaseTabs.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { ServiceError } from '@/services/http'
import { getModelMetrics } from '@/services/model'
import type { ModelMetrics, ModelTab } from '@/types/model'
import { formatNumber } from '@/utils/chart'

const props = defineProps<{
  tab: ModelTab
}>()

const TABS = [
  { key: 'metricas', label: 'Métricas' },
  { key: 'matriz', label: 'Matriz de confusión' },
  { key: 'datos', label: 'Datos de entrenamiento' },
  { key: 'modelo', label: 'Modelo' },
] as const

const router = useRouter()

const metrics = ref<ModelMetrics | null>(null)
const error = ref('')

async function load() {
  error.value = ''
  try {
    metrics.value = await getModelMetrics()
  } catch (cause) {
    if (!(cause instanceof ServiceError)) throw cause
    error.value = cause.message
  }
}

onMounted(load)

// La pestaña vive en la URL: el breadcrumb la nombra y un enlace puede abrirla directamente.
const tab = computed({
  get: () => props.tab,
  set: (value: ModelTab) =>
    router.replace({ name: 'modelo', params: value === 'metricas' ? {} : { tab: value } }),
})

const subtitle = computed(() =>
  metrics.value
    ? `Evaluación sobre ${formatNumber(metrics.value.split.test)} tickets de prueba.`
    : 'Cargando métricas…',
)
</script>

<template>
  <div class="model">
    <header class="model__header">
      <h1 class="model__title">Rendimiento del modelo</h1>
      <p class="model__subtitle">{{ error ? 'Sin métricas disponibles.' : subtitle }}</p>
    </header>

    <EmptyState v-if="error" :title="error" action-label="Reintentar" @action="load" />
    <BaseTabs v-else-if="metrics" v-model="tab" :tabs="TABS" label="Rendimiento del modelo">
      <ModelMetricsPanel v-if="tab === 'metricas'" :metrics="metrics" />
      <ConfusionMatrix
        v-else-if="tab === 'matriz'"
        :labels="metrics.confusionMatrix.labels"
        :matrix="metrics.confusionMatrix.matrix"
      />
      <TrainingData v-else-if="tab === 'datos'" :metrics="metrics" />
      <ModelSheet v-else :metrics="metrics" />
    </BaseTabs>
  </div>
</template>

<style scoped>
.model__header {
  margin-bottom: 20px;
}

.model__title {
  margin: 0;
  font-size: var(--font-size-24);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
}

.model__subtitle {
  margin: 6px 0 0;
  color: var(--color-text-muted);
}
</style>
