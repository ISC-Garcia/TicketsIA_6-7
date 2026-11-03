<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import BarList from '@/components/charts/BarList.vue'
import SlaColumns from '@/components/charts/SlaColumns.vue'
import TrendChart from '@/components/charts/TrendChart.vue'
import SlaCell from '@/components/tickets/SlaCell.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { getDashboard } from '@/services/dashboard'
import { ServiceError } from '@/services/http'
import type { Dashboard, DashboardKpis, DashboardPeriod } from '@/types/dashboard'
import type { Priority } from '@/types/ticket'
import { formatDelta, formatNumber } from '@/utils/chart'
import { minutesSince } from '@/utils/clock'

const props = defineProps<{
  period: DashboardPeriod
}>()

const PERIODS = [
  { key: 'semana', label: 'Última semana' },
  { key: 'mes', label: 'Último mes' },
  { key: 'año', label: 'Último año' },
] as const

const PRIORITY_COLORS: Record<Priority, string> = {
  Crítica: 'var(--color-priority-critical)',
  Alta: 'var(--color-priority-high)',
  Media: 'var(--color-priority-medium)',
  Baja: 'var(--color-priority-low)',
}
const DEPARTMENT_COLORS = [1, 2, 3, 4, 5].map((index) => `var(--color-chart-${index})`)

const router = useRouter()

const data = ref<Dashboard | null>(null)
const loading = ref(true)
const error = ref('')
let lastRequest = 0

async function load() {
  const request = ++lastRequest
  loading.value = true
  error.value = ''
  try {
    const result = await getDashboard(props.period)
    if (request === lastRequest) data.value = result
  } catch (cause) {
    if (request !== lastRequest) return
    error.value = cause instanceof ServiceError ? cause.message : 'No se pudo cargar el dashboard.'
  } finally {
    if (request === lastRequest) loading.value = false
  }
}

watch(() => props.period, load, { immediate: true })

// El periodo vive en la URL, como los filtros de la bandeja.
const period = computed({
  get: () => props.period,
  set: (value: DashboardPeriod) =>
    router.replace({ query: value === 'mes' ? {} : { periodo: value } }),
})

type Tone = 'good' | 'bad' | 'neutral'

// Tono de la variación: para algunos indicadores bajar es bueno y para otros, subir.
function tone(delta: number, lowerIsBetter: boolean): Tone {
  if (delta === 0) return 'neutral'
  return delta < 0 === lowerIsBetter ? 'good' : 'bad'
}

const WEEK = 'frente a hace 7 días'
const MONTH = 'frente a los 30 días anteriores'
const NO_DATA = 'Sin tickets resueltos en los últimos 30 días'

function kpiCards(kpis: DashboardKpis) {
  const average = kpis.averageResolutionHours
  const sla = kpis.slaCompliance
  const averageDelta =
    average !== null && kpis.averageResolutionHoursBefore !== null
      ? average - kpis.averageResolutionHoursBefore
      : null
  const slaDelta =
    sla !== null && kpis.slaComplianceBefore !== null ? sla - kpis.slaComplianceBefore : null
  const openDelta = kpis.openTickets - kpis.openTicketsBefore
  const criticalDelta = kpis.criticalOpen - kpis.criticalOpenBefore

  return [
    {
      label: 'Tickets abiertos',
      value: formatNumber(kpis.openTickets),
      delta: formatDelta(openDelta),
      tone: 'neutral' as Tone,
      comparison: WEEK,
    },
    {
      label: 'Críticos pendientes',
      value: formatNumber(kpis.criticalOpen),
      delta: formatDelta(criticalDelta),
      tone: tone(criticalDelta, true),
      comparison: WEEK,
    },
    {
      label: 'Tiempo promedio de resolución',
      value: average === null ? '—' : `${average.toFixed(1)} h`,
      delta: averageDelta === null ? '' : formatDelta(averageDelta, ' h', 1),
      tone: averageDelta === null ? ('neutral' as Tone) : tone(averageDelta, true),
      comparison: average === null ? NO_DATA : MONTH,
    },
    {
      label: 'Cumplimiento de SLA',
      value: sla === null ? '—' : `${sla.toFixed(1)} %`,
      delta: slaDelta === null ? '' : formatDelta(slaDelta, ' pts', 1),
      tone: slaDelta === null ? ('neutral' as Tone) : tone(slaDelta, false),
      comparison: sla === null ? NO_DATA : MONTH,
    },
  ]
}

const cards = computed(() => (data.value ? kpiCards(data.value.kpis) : []))

const priorityBars = computed(() =>
  (data.value?.byPriority ?? []).map((row) => ({
    label: row.label,
    value: row.count,
    color: PRIORITY_COLORS[row.label as Priority],
    note: data.value?.total ? `${((row.count / data.value.total) * 100).toFixed(1)} %` : undefined,
  })),
)

const departmentBars = computed(() =>
  (data.value?.byDepartment ?? []).map((row, index) => ({
    label: row.label,
    value: row.count,
    color: DEPARTMENT_COLORS[Math.min(index, DEPARTMENT_COLORS.length - 1)]!,
  })),
)
</script>

<template>
  <div class="dashboard">
    <header class="dashboard__header">
      <div>
        <h1 class="dashboard__title">Dashboard de carga de trabajo</h1>
        <p class="dashboard__subtitle">Estado de la mesa de ayuda y desempeño por prioridad.</p>
      </div>
      <SegmentedControl v-model="period" :options="PERIODS" label="Periodo" />
    </header>

    <EmptyState
      v-if="error"
      class="dashboard__state"
      :title="error"
      action-label="Reintentar"
      @action="load"
    />
    <p v-else-if="!data" class="dashboard__state dashboard__loading">Cargando indicadores…</p>

    <template v-else>
      <section class="dashboard__kpis" aria-label="Indicadores" :aria-busy="loading || undefined">
        <article v-for="card in cards" :key="card.label" class="dashboard__card dashboard__kpi">
          <h2 class="dashboard__kpi-label">{{ card.label }}</h2>
          <p class="dashboard__kpi-value">{{ card.value }}</p>
          <p class="dashboard__kpi-comparison">
            <span
              v-if="card.delta"
              class="dashboard__delta"
              :class="`dashboard__delta--${card.tone}`"
            >
              {{ card.delta }}
            </span>
            {{ card.comparison }}
          </p>
        </article>
      </section>

      <div class="dashboard__charts">
        <section class="dashboard__card dashboard__chart" aria-labelledby="chart-priority">
          <h2 id="chart-priority" class="dashboard__chart-title">Tickets por prioridad</h2>
          <p class="dashboard__chart-subtitle">
            Todos los tickets registrados, {{ formatNumber(data.total) }}
          </p>
          <BarList :items="priorityBars" label="Tickets por prioridad" />
        </section>

        <section class="dashboard__card dashboard__chart" aria-labelledby="chart-department">
          <h2 id="chart-department" class="dashboard__chart-title">Tickets por departamento</h2>
          <p class="dashboard__chart-subtitle">Todos los tickets registrados</p>
          <BarList
            :items="departmentBars"
            label="Tickets por departamento"
            :label-width="170"
            :bar-height="12"
          />
        </section>

        <section class="dashboard__card dashboard__chart" aria-labelledby="chart-trend">
          <h2 id="chart-trend" class="dashboard__chart-title">
            Tendencia de tickets creados y resueltos
          </h2>
          <p class="dashboard__chart-subtitle">{{ data.trend.subtitle }}</p>
          <TrendChart
            :labels="data.trend.labels"
            :created="data.trend.created"
            :resolved="data.trend.resolved"
          />
        </section>

        <section class="dashboard__card dashboard__chart" aria-labelledby="chart-sla">
          <h2 id="chart-sla" class="dashboard__chart-title">
            Tiempo promedio de resolución contra SLA
          </h2>
          <p class="dashboard__chart-subtitle">
            Horas por prioridad. La línea horizontal marca el SLA.
          </p>
          <SlaColumns :rows="data.resolutionVsSla" />
        </section>
      </div>

      <section class="dashboard__card" aria-labelledby="critical-title">
        <header class="dashboard__critical-header">
          <div>
            <h2 id="critical-title" class="dashboard__chart-title">Críticos sin resolver</h2>
            <p class="dashboard__critical-subtitle">SLA de 4 h</p>
          </div>
          <RouterLink :to="{ name: 'general' }" class="dashboard__link">
            Ver bandeja general
          </RouterLink>
        </header>
        <div v-if="data.critical.length" role="table" aria-label="Críticos sin resolver">
          <div role="rowgroup">
            <div role="row" class="dashboard__row dashboard__row--head">
              <span role="columnheader">ID</span>
              <span role="columnheader">Resumen</span>
              <span role="columnheader">Área</span>
              <span role="columnheader">Técnico asignado</span>
              <span role="columnheader">Estado</span>
              <span role="columnheader">Tiempo restante de SLA</span>
            </div>
          </div>
          <div role="rowgroup">
            <div v-for="ticket in data.critical" :key="ticket.id" role="row" class="dashboard__row">
              <span role="cell">
                <RouterLink
                  :to="{ name: 'general-detalle', params: { id: ticket.id } }"
                  class="dashboard__id"
                >
                  {{ ticket.id }}
                </RouterLink>
              </span>
              <span role="cell" class="dashboard__truncate" :title="ticket.description">
                {{ ticket.summary }}
              </span>
              <span role="cell" class="dashboard__muted">{{ ticket.area }}</span>
              <span role="cell" class="dashboard__truncate">{{
                ticket.technician ?? 'Sin asignar'
              }}</span>
              <span role="cell"><StatusBadge :status="ticket.status" /></span>
              <span role="cell">
                <SlaCell
                  :priority="ticket.priority"
                  :age-minutes="minutesSince(ticket.createdAt)"
                />
              </span>
            </div>
          </div>
        </div>
        <p v-else class="dashboard__no-critical">No hay tickets críticos pendientes.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dashboard__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  margin-bottom: 24px;
}

.dashboard__title {
  margin: 0;
  font-size: var(--font-size-24);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
}

.dashboard__subtitle {
  margin: 6px 0 0;
  color: var(--color-text-muted);
}

.dashboard__state {
  margin-top: 24px;
}

.dashboard__loading {
  color: var(--color-text-muted);
}

.dashboard__card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.dashboard__kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.dashboard__kpi {
  padding: 20px 22px;
}

.dashboard__kpi-label {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
  font-weight: var(--font-weight-regular);
}

.dashboard__kpi-value {
  margin: 6px 0 0;
  font-size: var(--font-size-34);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.dashboard__kpi-comparison {
  margin: 8px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.dashboard__delta {
  font-weight: var(--font-weight-medium);
  font-variant-numeric: tabular-nums;
}

.dashboard__delta--neutral {
  color: var(--color-text);
}

.dashboard__delta--good {
  color: var(--color-accent);
}

.dashboard__delta--bad {
  color: var(--color-danger);
}

.dashboard__charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.dashboard__chart {
  padding: 22px 24px;
}

.dashboard__chart-title {
  margin: 0;
  font-size: var(--font-size-14);
  font-weight: var(--font-weight-semibold);
}

.dashboard__chart-subtitle {
  margin: 2px 0 18px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.dashboard__critical-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid var(--color-border);
}

.dashboard__critical-subtitle {
  margin: 2px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.dashboard__link {
  color: var(--color-accent);
  font-size: var(--font-size-13);
}

.dashboard__row {
  display: grid;
  grid-template-columns: 112px minmax(0, 2.4fr) minmax(0, 1.2fr) minmax(0, 1.3fr) 100px 140px;
  gap: 16px;
  align-items: center;
  height: 52px;
  padding: 0 24px;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-13);
}

.dashboard__row--head {
  height: auto;
  padding: 10px 24px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
}

.dashboard__id {
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--font-size-12-5);
}

.dashboard__truncate {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard__muted {
  color: var(--color-text-muted);
}

.dashboard__no-critical {
  margin: 0;
  padding: 32px 24px;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
  text-align: center;
}
</style>
