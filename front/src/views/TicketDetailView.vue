<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ResolvePanel from '@/components/tickets/ResolvePanel.vue'
import TicketAnalysis from '@/components/tickets/TicketAnalysis.vue'
import TicketSummary from '@/components/tickets/TicketSummary.vue'
import TicketTimeline from '@/components/tickets/TicketTimeline.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import BaseTabs from '@/components/ui/BaseTabs.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PriorityBadge from '@/components/ui/PriorityBadge.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { ICONS } from '@/constants/icons'
import { listTicketEvents } from '@/services/events'
import { ServiceError } from '@/services/http'
import { attendTicket, getTicket } from '@/services/tickets'
import { useSessionStore } from '@/stores/session'
import { useToastStore } from '@/stores/toast'
import type { AuditEvent } from '@/types/event'
import type { Ticket } from '@/types/ticket'
import { minutesSince } from '@/utils/clock'
import { formatMinutes } from '@/utils/format'
import { SLA_HOURS, slaOf, type SlaState } from '@/utils/sla'

const props = defineProps<{
  id: string
}>()

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'analisis', label: 'Análisis IA' },
  { key: 'historial', label: 'Historial' },
] as const

const SLA_COLORS: Record<SlaState, string> = {
  normal: 'var(--color-accent)',
  risk: 'var(--color-warning)',
  overdue: 'var(--color-danger)',
  met: 'var(--color-accent)',
  missed: 'var(--color-danger)',
}

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const toast = useToastStore()

const ticket = ref<Ticket | null>(null)
const events = ref<AuditEvent[]>([])
const loading = ref(true)
const error = ref('')
const tab = ref<(typeof TABS)[number]['key']>('resumen')
const resolving = ref(false)
const attending = ref(false)
const actionError = ref('')

let lastRequest = 0

async function load(keepTab = false) {
  const request = ++lastRequest
  loading.value = true
  error.value = ''
  if (!keepTab) tab.value = 'resumen'

  try {
    // Si el ticket no existe, la API también responde 404 a su historial: eso no es una falla,
    // es el caso "no encontrado" que muestra la vista.
    const [found, history] = await Promise.all([
      getTicket(props.id),
      listTicketEvents(props.id).catch((cause) => {
        if (cause instanceof ServiceError && cause.status === 404) return []
        throw cause
      }),
    ])
    if (request !== lastRequest) return
    ticket.value = found
    events.value = history
  } catch (cause) {
    if (request !== lastRequest) return
    error.value = cause instanceof ServiceError ? cause.message : 'No se pudo cargar el ticket.'
  } finally {
    if (request === lastRequest) loading.value = false
  }
}

watch(
  () => props.id,
  () => load(),
  { immediate: true },
)

// El coordinador consulta en solo lectura; el técnico actúa sobre los tickets que tiene asignados.
const readOnly = computed(() => session.user?.role !== 'tecnico')
const assignedToMe = computed(
  () => !!ticket.value && ticket.value.technicianUsername === session.user?.username,
)
const canAttend = computed(
  () => !readOnly.value && assignedToMe.value && ticket.value?.status === 'Abierto',
)
const canResolve = computed(
  () => !readOnly.value && assignedToMe.value && ticket.value?.status === 'En atención',
)
const assignedNote = computed(() =>
  !readOnly.value && !assignedToMe.value && ticket.value?.status !== 'Resuelto'
    ? `Asignado a ${ticket.value?.technician ?? 'nadie todavía'}`
    : '',
)

async function attend() {
  if (!ticket.value) return
  attending.value = true
  actionError.value = ''
  try {
    ticket.value = await attendTicket(ticket.value.id)
    toast.show('Ticket en atención', ticket.value.id)
    await load(true)
  } catch (cause) {
    if (!(cause instanceof ServiceError)) throw cause
    actionError.value = cause.message
  } finally {
    attending.value = false
  }
}

function onResolved(updated: Ticket) {
  ticket.value = updated
  toast.show('Ticket resuelto', `${updated.id}, ${updated.resolutionHours?.toFixed(2)} h`)
  void load(true)
}

function showHistory() {
  resolving.value = false
  tab.value = 'historial'
}

const backToInbox = () => router.push({ name: String(route.meta.parent ?? 'bandeja') })

const sla = computed(() => {
  if (!ticket.value) return null
  const { priority, createdAt, resolutionHours } = ticket.value
  const status = slaOf(priority, minutesSince(createdAt), resolutionHours)

  let label = `Vence en ${formatMinutes(status.remainingMinutes)}`
  if (resolutionHours !== undefined) label = `Resuelto en ${resolutionHours.toFixed(2)} h`
  else if (status.state === 'overdue') label = 'Vencido'

  return { ...status, label, hours: SLA_HOURS[priority], color: SLA_COLORS[status.state] }
})
</script>

<template>
  <EmptyState
    v-if="error"
    class="detail__state"
    :title="error"
    action-label="Reintentar"
    @action="load"
  />
  <p v-else-if="loading && !ticket" class="detail__state detail__loading">Cargando ticket…</p>
  <EmptyState
    v-else-if="!ticket"
    class="detail__state"
    :title="`No se encontró el ticket ${id}`"
    action-label="Volver a la bandeja"
    @action="backToInbox"
  />
  <article v-else-if="sla" class="detail" :aria-busy="loading || undefined">
    <header class="detail__header">
      <div class="detail__heading">
        <div class="detail__badges">
          <h1 class="detail__id">{{ ticket.id }}</h1>
          <PriorityBadge :priority="ticket.priority" size="md" />
          <StatusBadge :status="ticket.status" size="md" />
          <span v-if="readOnly" class="detail__read-only">Solo lectura</span>
        </div>
        <p class="detail__summary">{{ ticket.summary }}</p>
        <p class="detail__reporter">
          Reportado por {{ ticket.reporter }}, área de {{ ticket.area }}
        </p>
      </div>

      <div class="detail__side">
        <div class="detail__sla" :class="`detail__sla--${sla.state}`">
          <div class="detail__sla-text">
            <span class="detail__sla-hours">SLA de {{ sla.hours }} h</span>
            <span class="detail__sla-label">{{ sla.label }}</span>
          </div>
          <ProgressBar
            class="detail__sla-bar"
            :value="sla.percent"
            :color="sla.color"
            label="SLA consumido"
          />
        </div>

        <div v-if="canAttend || canResolve || assignedNote" class="detail__actions">
          <BaseButton v-if="canAttend" size="lg" :disabled="attending" @click="attend">
            Atender
          </BaseButton>
          <BaseButton v-if="canResolve" size="lg" @click="resolving = true">
            <BaseIcon :path="ICONS.check" :size="18" />
            Marcar como resuelto
          </BaseButton>
          <span v-if="assignedNote" class="detail__assigned">{{ assignedNote }}</span>
          <p v-if="actionError" class="detail__action-error" role="alert">{{ actionError }}</p>
        </div>
      </div>
    </header>

    <BaseTabs v-slot="{ active }" v-model="tab" :tabs="TABS" label="Secciones del ticket">
      <TicketSummary v-if="active === 'resumen'" :ticket="ticket" />
      <template v-else-if="active === 'analisis'">
        <TicketAnalysis v-if="ticket.analysis" :ticket="{ ...ticket, analysis: ticket.analysis }" />
        <!-- Los tickets históricos del dataset se registraron antes de que el modelo existiera. -->
        <EmptyState v-else title="Este ticket histórico no tiene análisis del modelo" />
      </template>
      <div v-else class="detail__history">
        <TicketTimeline v-if="events.length" :events="events" />
        <p v-else class="detail__empty-history">Este ticket aún no tiene movimientos.</p>
      </div>
    </BaseTabs>

    <ResolvePanel
      v-if="resolving"
      :ticket="ticket"
      @close="resolving = false"
      @resolved="onResolved"
      @history="showHistory"
    />
  </article>
</template>

<style scoped>
.detail__side {
  display: flex;
  flex: none;
  align-items: flex-start;
  gap: 20px;
}

.detail__actions {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.detail__assigned {
  padding-top: 12px;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}

.detail__action-error {
  max-width: 240px;
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-size-12);
  text-align: right;
}

.detail__read-only {
  margin-left: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.detail__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 32px;
  margin-bottom: 24px;
}

.detail__heading {
  min-width: 0;
}

.detail__badges {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail__id {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--font-size-22);
  font-weight: var(--font-weight-medium);
  letter-spacing: -0.01em;
}

.detail__summary {
  margin: 10px 0 0;
  font-size: var(--font-size-16);
  font-weight: var(--font-weight-medium);
  text-wrap: pretty;
}

.detail__reporter {
  margin: 4px 0 0;
  color: var(--color-text-muted);
}

.detail__sla {
  flex: none;
  width: 240px;
  padding: 12px 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.detail__sla-text {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-12);
}

.detail__sla-hours {
  color: var(--color-text-muted);
}

.detail__sla-label {
  font-weight: var(--font-weight-medium);
}

.detail__sla--risk .detail__sla-label {
  color: var(--color-warning);
}

.detail__sla--overdue .detail__sla-label,
.detail__sla--missed .detail__sla-label {
  color: var(--color-danger);
}

.detail__sla--met .detail__sla-label {
  color: var(--color-accent);
}

.detail__sla-bar {
  margin-top: 10px;
}

.detail__history {
  max-width: 860px;
  padding: 4px 28px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.detail__empty-history {
  margin: 0;
  padding: 24px 0;
  color: var(--color-text-muted);
}

.detail__state {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.detail__loading {
  margin: 0;
  padding: 64px 24px;
  color: var(--color-text-muted);
  text-align: center;
}
</style>
