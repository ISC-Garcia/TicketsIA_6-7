<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import TicketTimeline from '@/components/tickets/TicketTimeline.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PriorityBadge from '@/components/ui/PriorityBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { listEvents, listTicketEvents } from '@/services/events'
import { ServiceError } from '@/services/http'
import { getTicket } from '@/services/tickets'
import type { AuditEvent } from '@/types/event'
import type { Ticket } from '@/types/ticket'

const props = defineProps<{
  id?: string
}>()

const ID_PATTERN = /^TCK-\d{6}$/
const FORMAT_ERROR = 'Escribe un ID con el formato TCK-000000.'

const router = useRouter()

const query = ref(props.id ?? '')
const formatError = ref('')
const loading = ref(false)
const error = ref('')
const notFound = ref('')
const ticket = ref<Ticket | null>(null)
const events = ref<AuditEvent[]>([])

let lastRequest = 0

async function load(id: string) {
  const request = ++lastRequest
  loading.value = true
  error.value = ''
  notFound.value = ''
  ticket.value = null
  try {
    const found = await getTicket(id)
    const timeline = found ? await listTicketEvents(id) : []
    if (request !== lastRequest) return
    ticket.value = found
    events.value = timeline
    if (!found) notFound.value = id
  } catch (cause) {
    if (request !== lastRequest) return
    error.value = cause instanceof ServiceError ? cause.message : 'No se pudo consultar el ticket.'
  } finally {
    if (request === lastRequest) loading.value = false
  }
}

// El ID vive en la URL: el historial se puede compartir y la bitácora lo abre directo.
watch(
  () => props.id,
  (id) => {
    query.value = id ?? ''
    formatError.value = ''
    if (!id) {
      ticket.value = null
      notFound.value = ''
      return
    }
    if (ID_PATTERN.test(id)) void load(id)
    else formatError.value = FORMAT_ERROR
  },
  { immediate: true },
)

function consult(value = query.value) {
  const id = value.trim().toUpperCase()
  if (!ID_PATTERN.test(id)) {
    formatError.value = FORMAT_ERROR
    return
  }
  formatError.value = ''
  if (id === props.id) void load(id)
  else router.push({ name: 'historial', params: { id } })
}

// Los ejemplos salen de la bitácora: el ticket con el movimiento más reciente y el de la última
// edición posterior al cierre, si la hay.
const examples = ref<string[]>([])

onMounted(async () => {
  try {
    const [recent, afterClose] = await Promise.all([
      listEvents({ pageSize: 10 }),
      listEvents({ afterClose: true, pageSize: 1 }),
    ])
    const ids = [
      recent.items.find((event) => event.ticketId)?.ticketId,
      afterClose.items[0]?.ticketId,
    ]
    examples.value = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  } catch (cause) {
    if (!(cause instanceof ServiceError)) throw cause
  }
})

const fields = computed(() => {
  const current = ticket.value
  if (!current) return []
  return [
    { label: 'Área solicitante', value: current.area },
    { label: 'Departamento', value: current.department },
    { label: 'Técnico asignado', value: current.technician ?? 'Sin asignar' },
    {
      label: 'Tiempo de resolución',
      value:
        current.resolutionHours === undefined
          ? 'Sin resolver'
          : `${current.resolutionHours.toFixed(2)} h`,
      afterClose: current.editedAfterClose,
    },
  ]
})
</script>

<template>
  <div class="history">
    <header class="history__header">
      <h1 class="history__title">Historial de ticket</h1>
      <p class="history__subtitle">
        Datos actuales de un ticket y su línea de tiempo completa tomada de la bitácora.
      </p>
    </header>

    <form class="history__card history__search" novalidate @submit.prevent="consult()">
      <label for="history-id" class="history__label">ID de ticket</label>
      <div class="history__row">
        <BaseInput
          id="history-id"
          v-model="query"
          mono
          placeholder="TCK-000000"
          class="history__input"
          :invalid="Boolean(formatError)"
          :aria-describedby="formatError ? 'history-error' : undefined"
        />
        <BaseButton type="submit" :disabled="loading">Consultar</BaseButton>
      </div>
      <p v-if="formatError" id="history-error" class="history__error" role="alert">
        {{ formatError }}
      </p>
      <p v-if="examples.length" class="history__examples">
        Ejemplos:
        <button
          v-for="example in examples"
          :key="example"
          type="button"
          class="history__example"
          @click="consult(example)"
        >
          {{ example }}
        </button>
      </p>
    </form>

    <p v-if="loading" class="history__card history__state" role="status">Consultando bitácora…</p>
    <EmptyState
      v-else-if="error"
      class="history__card"
      :title="error"
      action-label="Reintentar"
      @action="consult()"
    />
    <section v-else-if="notFound" class="history__card history__state">
      <h2 class="history__state-title">No se encontró ningún ticket con ese ID</h2>
      <p class="history__muted">
        Revisa el ID <span class="history__mono">{{ notFound }}</span> o consulta uno de los
        ejemplos.
      </p>
    </section>

    <div v-else-if="ticket" class="history__result">
      <section class="history__card history__ticket" aria-label="Datos actuales">
        <div class="history__ticket-heading">
          <span class="history__ticket-id">{{ ticket.id }}</span>
          <PriorityBadge :priority="ticket.priority" />
          <StatusBadge :status="ticket.status" />
        </div>
        <p class="history__summary">{{ ticket.summary }}</p>
        <dl class="history__fields">
          <div v-for="field in fields" :key="field.label" class="history__field">
            <dt>{{ field.label }}</dt>
            <dd>
              <span v-if="field.afterClose" class="history__badge"
                >Edición posterior al cierre</span
              >
              {{ field.value }}
            </dd>
          </div>
        </dl>
      </section>

      <section class="history__card history__timeline" aria-labelledby="history-timeline">
        <h2 id="history-timeline" class="history__timeline-title">Línea de tiempo</h2>
        <TicketTimeline v-if="events.length" :events="events" />
        <p v-else class="history__muted">Este ticket no tiene movimientos en la bitácora.</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.history__header {
  margin-bottom: 24px;
}

.history__title {
  margin: 0;
  font-size: var(--font-size-24);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
}

.history__subtitle {
  margin: 6px 0 0;
  color: var(--color-text-muted);
}

.history__card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.history__search {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 900px;
  margin-bottom: 16px;
  padding: 22px 24px;
}

.history__label {
  font-size: var(--font-size-13);
  font-weight: var(--font-weight-medium);
}

.history__row {
  display: flex;
  gap: 10px;
}

.history__input {
  max-width: 360px;
}

.history__error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-size-12);
}

.history__examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.history__example {
  padding: 0 4px;
  background: none;
  border: none;
  color: var(--color-accent);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: var(--font-size-12);
}

.history__state {
  max-width: 900px;
  margin: 0;
  padding: 40px 24px;
  text-align: center;
}

.history__state-title {
  margin: 0;
  font-size: var(--font-size-15);
  font-weight: var(--font-weight-medium);
}

.history__muted {
  margin: 6px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}

.history__mono {
  font-family: var(--font-mono);
}

.history__result {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr);
  gap: 16px;
  align-items: start;
  max-width: 1180px;
}

.history__ticket {
  padding: 22px 24px;
}

.history__ticket-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.history__ticket-id {
  font-family: var(--font-mono);
  font-size: var(--font-size-18);
  font-weight: var(--font-weight-medium);
}

.history__summary {
  margin: 8px 0 0;
  font-size: var(--font-size-14);
  line-height: 1.45;
}

.history__fields {
  margin: 16px 0 0;
  padding-top: 4px;
  border-top: 1px solid var(--color-border-subtle);
}

.history__field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 11px 0;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-13);
}

.history__field:last-child {
  border-bottom: none;
}

.history__field dt {
  flex: none;
  color: var(--color-text-muted);
}

.history__field dd {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-weight: var(--font-weight-medium);
  text-align: right;
}

.history__badge {
  padding: 2px 8px;
  background: var(--color-warning-soft);
  border-radius: var(--radius-4);
  color: var(--color-warning);
  font-size: var(--font-size-12);
  white-space: nowrap;
}

.history__timeline {
  padding: 4px 28px 8px;
}

.history__timeline-title {
  margin: 0;
  padding: 16px 0 6px;
  font-size: var(--font-size-14);
  font-weight: var(--font-weight-semibold);
}
</style>
