<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import LineChart from '@/components/charts/LineChart.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { ICONS } from '@/constants/icons'
import { getDatabaseStatus } from '@/services/database'
import { ServiceError } from '@/services/http'
import type { DatabaseStatus, MonitorPeriod } from '@/types/database'
import { formatNumber, formatPercent } from '@/utils/chart'
import { formatBytes, formatUptime } from '@/utils/format'

const props = defineProps<{
  period: MonitorPeriod
}>()

const PERIODS = [
  { key: '24h', label: 'Últimas 24 horas' },
  { key: 'semana', label: 'Última semana' },
  { key: 'mes', label: 'Último mes' },
] as const

const router = useRouter()

const status = ref<DatabaseStatus | null>(null)
const loading = ref(true)
const error = ref('')
let lastRequest = 0

async function load() {
  const request = ++lastRequest
  loading.value = true
  error.value = ''
  try {
    const result = await getDatabaseStatus(props.period)
    if (request === lastRequest) status.value = result
  } catch (cause) {
    if (request !== lastRequest) return
    error.value = cause instanceof ServiceError ? cause.message : 'No se pudo consultar PostgreSQL.'
  } finally {
    if (request === lastRequest) loading.value = false
  }
}

watch(() => props.period, load, { immediate: true })

const period = computed({
  get: () => props.period,
  set: (value: MonitorPeriod) =>
    router.replace({ query: value === '24h' ? {} : { periodo: value } }),
})

const DASH = '—'

const indicators = computed(() => {
  const current = status.value
  if (!current) return []
  const { server } = current
  return [
    {
      label: 'Estado del servidor',
      value: server.online ? 'En línea' : 'Sin conexión',
      state: server.online ? 'online' : 'offline',
    },
    {
      label: 'Tiempo activo',
      value: server.uptimeSeconds === undefined ? DASH : formatUptime(server.uptimeSeconds),
    },
    {
      label: 'Conexiones activas',
      value: current.connections
        ? `${current.connections.active} de ${current.connections.max}`
        : DASH,
    },
    {
      label: 'Latencia promedio',
      value: current.latencyMs === undefined ? DASH : `${current.latencyMs.toFixed(1)} ms`,
    },
    {
      label: 'Consultas por minuto',
      value:
        current.queriesPerMinute === undefined
          ? DASH
          : formatNumber(Math.round(current.queriesPerMinute)),
      note:
        current.queriesPerMinute === undefined && server.online
          ? 'Se calcula con la siguiente muestra'
          : '',
    },
    {
      label: 'Tamaño de la base de datos',
      value: current.sizeBytes === undefined ? DASH : formatBytes(current.sizeBytes),
    },
    {
      label: 'Aciertos de caché',
      value: current.cacheHitRatio === undefined ? DASH : formatPercent(current.cacheHitRatio),
    },
  ]
})

const checkedAt = computed(() =>
  status.value ? `Actualizado a las ${status.value.checkedAt.slice(11)}` : '',
)
</script>

<template>
  <div class="monitor">
    <header class="monitor__header">
      <div>
        <h1 class="monitor__title">Monitoreo de base de datos</h1>
        <p class="monitor__subtitle">Estado real del servidor PostgreSQL que usa el sistema.</p>
      </div>
      <div class="monitor__controls">
        <span class="monitor__checked" aria-live="polite">
          {{ loading ? 'Actualizando…' : checkedAt }}
        </span>
        <BaseButton variant="secondary" size="sm" :disabled="loading" @click="load">
          <BaseIcon :path="ICONS.refresh" :size="16" />
          Actualizar
        </BaseButton>
        <SegmentedControl v-model="period" :options="PERIODS" label="Periodo" size="sm" />
      </div>
    </header>

    <EmptyState
      v-if="error && !status"
      class="monitor__card monitor__state"
      :title="error"
      action-label="Reintentar"
      @action="load"
    />
    <p v-else-if="!status" class="monitor__card monitor__state">Consultando PostgreSQL…</p>
    <template v-else>
      <p v-if="error" class="monitor__error" role="alert">{{ error }}</p>
      <section class="monitor__indicators" aria-label="Indicadores">
        <article
          v-for="item in indicators"
          :key="item.label"
          class="monitor__card monitor__indicator"
        >
          <h2 class="monitor__indicator-label">{{ item.label }}</h2>
          <p class="monitor__indicator-value">
            <span
              v-if="item.state"
              class="monitor__dot"
              :class="`monitor__dot--${item.state}`"
              aria-hidden="true"
            />
            {{ item.value }}
          </p>
          <p v-if="item.note" class="monitor__note">{{ item.note }}</p>
        </article>
      </section>

      <div v-if="status.trend" class="monitor__charts">
        <section class="monitor__card monitor__chart" aria-labelledby="chart-queries">
          <h2 id="chart-queries" class="monitor__chart-title">Consultas por hora</h2>
          <p class="monitor__chart-subtitle">{{ status.trend.subtitle }}</p>
          <LineChart
            :labels="status.trend.labels"
            :values="status.trend.queriesPerHour"
            name="Consultas por hora"
          />
        </section>
        <section class="monitor__card monitor__chart" aria-labelledby="chart-connections">
          <h2 id="chart-connections" class="monitor__chart-title">Conexiones activas</h2>
          <p class="monitor__chart-subtitle">{{ status.trend.subtitle }}, promedio</p>
          <LineChart
            :labels="status.trend.labels"
            :values="status.trend.connections"
            name="Conexiones activas"
            tone="light"
          />
        </section>
      </div>

      <section
        v-if="status.slowQueries"
        class="monitor__card monitor__slow"
        aria-labelledby="slow-title"
      >
        <header class="monitor__slow-header">
          <h2 id="slow-title" class="monitor__chart-title">Consultas más lentas</h2>
          <p class="monitor__chart-subtitle">
            Desde que se reinició el registro de PostgreSQL, ordenadas por tiempo promedio
          </p>
        </header>
        <p v-if="!status.slowQueries.available" class="monitor__slow-empty">
          La extensión pg_stat_statements no está activa en el servidor, así que no hay registro de
          consultas lentas.
        </p>
        <p v-else-if="!status.slowQueries.items.length" class="monitor__slow-empty">
          Aún no hay consultas registradas.
        </p>
        <table v-else class="monitor__table">
          <thead>
            <tr>
              <th scope="col">Consulta</th>
              <th scope="col" class="monitor__number">Tiempo promedio</th>
              <th scope="col" class="monitor__number">Ejecuciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in status.slowQueries.items" :key="item.query">
              <td class="monitor__query" :title="item.query">{{ item.query }}</td>
              <td class="monitor__number monitor__strong">{{ item.meanMs.toFixed(1) }} ms</td>
              <td class="monitor__number monitor__muted">{{ formatNumber(item.calls) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<style scoped>
.monitor__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  margin-bottom: 20px;
}

.monitor__title {
  margin: 0;
  font-size: var(--font-size-24);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
}

.monitor__subtitle {
  margin: 6px 0 0;
  color: var(--color-text-muted);
}

.monitor__controls {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
}

.monitor__checked {
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  font-variant-numeric: tabular-nums;
}

.monitor__card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.monitor__state {
  margin: 0;
  padding: 64px 24px;
  color: var(--color-text-muted);
  text-align: center;
}

.monitor__error {
  margin: 0 0 12px;
  color: var(--color-danger);
  font-size: var(--font-size-13);
}

.monitor__indicators {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.monitor__indicator {
  padding: 18px 22px;
}

.monitor__indicator-label {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
  font-weight: var(--font-weight-regular);
}

.monitor__indicator-value {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 0 0;
  font-size: var(--font-size-28);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.monitor__dot {
  width: 10px;
  height: 10px;
  flex: none;
  border-radius: 50%;
}

.monitor__dot--online {
  background: var(--color-accent);
}

.monitor__dot--offline {
  background: var(--color-danger);
}

.monitor__note {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.monitor__charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.monitor__chart {
  padding: 22px 24px;
}

.monitor__chart-title {
  margin: 0;
  font-size: var(--font-size-14);
  font-weight: var(--font-weight-semibold);
}

.monitor__chart-subtitle {
  margin: 2px 0 14px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.monitor__slow-header {
  padding: 16px 24px 2px;
  border-bottom: 1px solid var(--color-border);
}

.monitor__slow-empty {
  margin: 0;
  padding: 24px;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}

.monitor__table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: var(--font-size-13);
  font-variant-numeric: tabular-nums;
}

.monitor__table th,
.monitor__table td {
  padding: 12px 24px;
  border-bottom: 1px solid var(--color-border-subtle);
  text-align: left;
}

.monitor__table tr:last-child td {
  border-bottom: none;
}

.monitor__table th {
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
}

.monitor__table th:not(:first-child) {
  width: 160px;
}

.monitor__table .monitor__number {
  text-align: right;
}

.monitor__query {
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: var(--font-size-12-5);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.monitor__strong {
  font-weight: var(--font-weight-medium);
}

.monitor__muted {
  color: var(--color-text-muted);
}
</style>
