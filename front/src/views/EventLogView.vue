<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import EventPanel from '@/components/events/EventPanel.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import { listEvents } from '@/services/events'
import { ServiceError } from '@/services/http'
import { EVENT_TYPES, type AuditEvent, type EventDateFilter } from '@/types/event'
import { eventFiltersToQuery, hasEventFilters, type EventFilters } from '@/utils/eventFilters'

const props = defineProps<{
  filters: EventFilters
}>()

const DATE_OPTIONS: { value: EventDateFilter; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7', label: 'Últimos 7 días' },
]
const PAGE_SIZE = 10

const router = useRouter()

const events = ref<AuditEvent[]>([])
const total = ref(0)
const afterCloseTotal = ref(0)
const users = ref<string[]>([])
const loading = ref(true)
const error = ref('')
const selected = ref<AuditEvent | null>(null)

let lastRequest = 0

async function load() {
  const request = ++lastRequest
  loading.value = true
  error.value = ''
  try {
    const page = await listEvents({ ...props.filters, pageSize: PAGE_SIZE })
    if (request !== lastRequest) return
    events.value = page.items
    total.value = page.total
    afterCloseTotal.value = page.afterCloseTotal
    users.value = page.users
  } catch (cause) {
    if (request !== lastRequest) return
    error.value = cause instanceof ServiceError ? cause.message : 'No se pudo cargar la bitácora.'
  } finally {
    if (request === lastRequest) loading.value = false
  }
}

watch(() => props.filters, load, { immediate: true })

// Cambiar un filtro vuelve a la primera página.
function update(changes: EventFilters) {
  const page = 'page' in changes ? changes.page : undefined
  router.replace({ query: eventFiltersToQuery({ ...props.filters, ...changes, page }) })
}

function clearFilters() {
  router.replace({ query: {} })
}

const page = computed({
  get: () => props.filters.page ?? 1,
  set: (value: number) => update({ page: value }),
})

const type = computed({
  get: () => props.filters.type ?? '',
  set: (value: string) => update({ type: EVENT_TYPES.find((item) => item === value) }),
})

const user = computed({
  get: () => props.filters.user ?? '',
  set: (value: string) => update({ user: value || undefined }),
})

const date = computed({
  get: () => props.filters.date ?? '',
  set: (value: string) =>
    update({ date: DATE_OPTIONS.find((item) => item.value === value)?.value }),
})

// El ID se busca exacto: se aplica al confirmar el campo, no con cada tecla.
const ticketId = ref(props.filters.ticketId ?? '')
watch(
  () => props.filters.ticketId,
  (value) => {
    ticketId.value = value ?? ''
  },
)
const applyTicketId = () => update({ ticketId: ticketId.value.trim().toUpperCase() || undefined })

const toggleAfterClose = () => update({ afterClose: !props.filters.afterClose || undefined })

const hasFilters = computed(() => hasEventFilters(props.filters))
const firstLoad = computed(() => loading.value && !events.value.length)
const eventCount = computed(() =>
  total.value === 1 ? '1 evento' : `${total.value.toLocaleString('es-MX')} eventos`,
)

function openHistory(id: string) {
  selected.value = null
  router.push({ name: 'historial', params: { id } })
}
</script>

<template>
  <div class="log">
    <header class="log__header">
      <h1 class="log__title">Bitácora de registros</h1>
      <p class="log__subtitle">
        Eventos del sistema en orden cronológico, del más reciente al más antiguo.
      </p>
    </header>

    <div class="log__toolbar">
      <button
        type="button"
        class="log__after-close"
        :class="{ 'log__after-close--on': filters.afterClose }"
        :aria-pressed="!!filters.afterClose"
        @click="toggleAfterClose"
      >
        <span class="log__check" aria-hidden="true" />
        Solo ediciones posteriores al cierre
        <span class="log__after-close-count">{{ afterCloseTotal }}</span>
      </button>
      <BaseSelect v-model="type" size="sm" aria-label="Tipo de evento">
        <option value="">Tipo de evento: todos</option>
        <option v-for="item in EVENT_TYPES" :key="item">{{ item }}</option>
      </BaseSelect>
      <BaseSelect v-model="user" size="sm" aria-label="Usuario">
        <option value="">Usuario: todos</option>
        <option v-for="item in users" :key="item">{{ item }}</option>
      </BaseSelect>
      <BaseSelect v-model="date" size="sm" aria-label="Rango de fechas">
        <option value="">Cualquier fecha</option>
        <option v-for="item in DATE_OPTIONS" :key="item.value" :value="item.value">
          {{ item.label }}
        </option>
      </BaseSelect>
      <BaseInput
        v-model="ticketId"
        size="sm"
        mono
        placeholder="ID de ticket"
        aria-label="Buscar por ID de ticket"
        class="log__ticket"
        @change="applyTicketId"
      />
      <BaseButton v-if="hasFilters" variant="link" @click="clearFilters">
        Limpiar filtros
      </BaseButton>
      <span v-if="!error && !firstLoad" class="log__count" aria-live="polite">
        {{ eventCount }}
      </span>
    </div>

    <EmptyState
      v-if="error"
      class="log__state"
      :title="error"
      action-label="Reintentar"
      @action="load"
    />
    <p v-else-if="firstLoad" class="log__state log__loading">Cargando eventos…</p>
    <div
      v-else
      class="log__table"
      role="table"
      aria-label="Eventos"
      :aria-busy="loading || undefined"
    >
      <div role="rowgroup">
        <div role="row" class="log__row log__row--head">
          <span role="columnheader">Fecha y hora</span>
          <span role="columnheader">Usuario</span>
          <span role="columnheader">Tipo de evento</span>
          <span role="columnheader">Ticket</span>
          <span role="columnheader">Detalle</span>
        </div>
      </div>
      <div role="rowgroup">
        <div
          v-for="event in events"
          :key="event.id"
          role="row"
          class="log__row"
          :class="{
            'log__row--after-close': event.afterClose,
            'log__row--selected': selected?.id === event.id,
          }"
          @click="selected = event"
        >
          <span role="cell">
            <button type="button" class="log__open">{{ event.time }}</button>
          </span>
          <span role="cell" class="log__truncate" :title="event.user">{{ event.user }}</span>
          <span role="cell"
            ><span class="log__type">{{ event.type }}</span></span
          >
          <span role="cell" class="log__mono">{{ event.ticketId }}</span>
          <span role="cell" class="log__detail">
            <span v-if="event.afterClose" class="log__badge">Edición posterior al cierre</span>
            <span class="log__truncate log__muted" :title="event.detail">{{ event.detail }}</span>
          </span>
        </div>
      </div>
      <EmptyState
        v-if="!events.length"
        title="No hay eventos que coincidan con los filtros"
        action-label="Limpiar filtros"
        @action="clearFilters"
      />
      <PaginationBar v-else v-model:page="page" :page-size="PAGE_SIZE" :total="total" />
    </div>

    <EventPanel v-if="selected" :event="selected" @close="selected = null" @history="openHistory" />
  </div>
</template>

<style scoped>
.log__header {
  margin-bottom: 20px;
}

.log__title {
  margin: 0;
  font-size: var(--font-size-24);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
}

.log__subtitle {
  margin: 6px 0 0;
  color: var(--color-text-muted);
}

.log__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.log__after-close {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-6);
  color: var(--color-text);
  cursor: pointer;
  font-size: var(--font-size-13);
}

.log__after-close--on {
  background: var(--color-warning-soft);
  border-color: var(--color-warning);
  color: var(--color-warning);
  font-weight: var(--font-weight-medium);
}

.log__check {
  width: 14px;
  height: 14px;
  flex: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-3);
}

.log__after-close--on .log__check {
  background: var(--color-warning);
  border-color: var(--color-warning);
}

.log__after-close-count {
  color: var(--color-warning);
  font-weight: var(--font-weight-semibold);
}

.log__ticket {
  width: 160px;
}

.log__count {
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}

.log__state {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.log__loading {
  margin: 0;
  padding: 64px 24px;
  color: var(--color-text-muted);
  text-align: center;
}

.log__table {
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.log__row {
  position: relative;
  display: grid;
  grid-template-columns: 164px minmax(0, 1.3fr) 156px 112px minmax(0, 2fr);
  gap: 14px;
  align-items: center;
  height: 52px;
  padding: 0 20px;
  border-bottom: 1px solid var(--color-border-subtle);
  cursor: pointer;
  font-size: var(--font-size-13);
}

.log__row:hover,
.log__row--selected {
  background: var(--color-accent-soft);
}

.log__row--head {
  height: auto;
  padding: 11px 20px;
  background: var(--color-surface-muted);
  border-bottom-color: var(--color-border);
  color: var(--color-text-muted);
  cursor: default;
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
}

.log__row--head:hover {
  background: var(--color-surface-muted);
}

/* Marca ámbar a la izquierda de las ediciones posteriores al cierre. */
.log__row--after-close::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  background: var(--color-warning);
}

.log__open {
  padding: 0;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.log__type {
  display: inline-block;
  padding: 2px 8px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-4);
  font-size: var(--font-size-12);
  white-space: nowrap;
}

.log__mono {
  font-family: var(--font-mono);
  font-size: var(--font-size-12-5);
}

.log__detail {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.log__badge {
  flex: none;
  padding: 2px 8px;
  background: var(--color-warning-soft);
  border-radius: var(--radius-4);
  color: var(--color-warning);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.log__truncate {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log__muted {
  color: var(--color-text-muted);
}
</style>
