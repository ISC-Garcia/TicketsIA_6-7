<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import PriorityFilter from '@/components/tickets/PriorityFilter.vue'
import TicketTable from '@/components/tickets/TicketTable.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { ServiceError } from '@/services/mockRequest'
import { countTicketsByPriority, listTickets } from '@/services/tickets'
import { DEPARTMENTS, PRIORITIES, TICKET_STATUSES } from '@/types/ticket'
import type { Priority, Ticket, TicketDateFilter } from '@/types/ticket'
import { formatTicketCount } from '@/utils/format'
import { hasTicketFilters, ticketFiltersToQuery, type TicketFilters } from '@/utils/ticketFilters'

const props = defineProps<{
  filters: TicketFilters
}>()

const DATE_OPTIONS: { value: TicketDateFilter; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: '48', label: 'Últimas 48 h' },
  { value: '7', label: 'Últimos 7 días' },
]

const router = useRouter()

const tickets = ref<Ticket[]>([])
const counts = ref(
  Object.fromEntries(PRIORITIES.map((priority) => [priority, 0])) as Record<Priority, number>,
)
const loading = ref(true)
const error = ref('')

let lastRequest = 0

// Solo la respuesta más reciente se muestra, aunque otra más vieja llegue después.
async function load() {
  const request = ++lastRequest
  loading.value = true
  error.value = ''

  try {
    const [page, totals] = await Promise.all([
      listTickets(props.filters),
      countTicketsByPriority(props.filters.status === 'Resuelto'),
    ])
    if (request !== lastRequest) return
    tickets.value = page.items
    counts.value = totals
  } catch (cause) {
    if (request !== lastRequest) return
    error.value = cause instanceof ServiceError ? cause.message : 'No se pudo cargar la bandeja.'
  } finally {
    if (request === lastRequest) loading.value = false
  }
}

watch(() => props.filters, load, { immediate: true })

function update(changes: TicketFilters) {
  router.replace({ query: ticketFiltersToQuery({ ...props.filters, ...changes }) })
}

// La búsqueda se guarda aparte para no reescribir el campo mientras se escribe.
// Solo se sincroniza desde la URL cuando los filtros se limpian.
const search = ref(props.filters.search ?? '')
watch(search, (value) => update({ search: value }))
watch(
  () => props.filters.search,
  (value) => {
    if (!value) search.value = ''
  },
)

function clearFilters() {
  router.replace({ query: {} })
}

const priority = computed({
  get: () => props.filters.priority ?? '',
  set: (value: Priority | '') => update({ priority: value || undefined }),
})

const department = computed({
  get: () => props.filters.department ?? '',
  set: (value: string) => update({ department: DEPARTMENTS.find((item) => item === value) }),
})

const status = computed({
  get: () => props.filters.status ?? '',
  set: (value: string) => update({ status: TICKET_STATUSES.find((item) => item === value) }),
})

const date = computed({
  get: () => props.filters.date ?? '',
  set: (value: string) =>
    update({ date: DATE_OPTIONS.find((item) => item.value === value)?.value }),
})

const hasFilters = computed(() => hasTicketFilters(props.filters))
const firstLoad = computed(() => loading.value && !tickets.value.length)
const rowCount = computed(() => formatTicketCount(tickets.value.length))
</script>

<template>
  <div class="inbox">
    <header class="inbox__header">
      <h1 class="inbox__title">Bandeja de incidentes</h1>
      <p class="inbox__subtitle">
        Ordenada por prioridad y antigüedad. Selecciona un ticket para atenderlo.
      </p>
    </header>

    <PriorityFilter v-model="priority" :counts="counts" class="inbox__priorities" />

    <div class="inbox__toolbar">
      <BaseInput
        v-model="search"
        size="sm"
        type="search"
        placeholder="Buscar por ID o texto"
        aria-label="Buscar por ID o texto"
        class="inbox__search"
      />
      <BaseSelect v-model="department" size="sm" aria-label="Departamento">
        <option value="">Departamento: todos</option>
        <option v-for="item in DEPARTMENTS" :key="item">{{ item }}</option>
      </BaseSelect>
      <BaseSelect v-model="status" size="sm" aria-label="Estado">
        <option value="">Estado: todos</option>
        <option v-for="item in TICKET_STATUSES" :key="item">{{ item }}</option>
      </BaseSelect>
      <BaseSelect v-model="date" size="sm" aria-label="Fecha de registro">
        <option value="">Cualquier fecha</option>
        <option v-for="item in DATE_OPTIONS" :key="item.value" :value="item.value">
          {{ item.label }}
        </option>
      </BaseSelect>
      <BaseButton v-if="hasFilters" variant="link" @click="clearFilters"
        >Limpiar filtros</BaseButton
      >
      <span v-if="!error && !firstLoad" class="inbox__count" aria-live="polite">
        {{ rowCount }}
      </span>
    </div>

    <EmptyState
      v-if="error"
      class="inbox__state"
      :title="error"
      action-label="Reintentar"
      @action="load"
    />
    <p v-else-if="firstLoad" class="inbox__state inbox__loading">Cargando tickets…</p>
    <TicketTable v-else :tickets="tickets" :busy="loading">
      <template #empty>
        <EmptyState
          title="No hay tickets que coincidan con los filtros"
          action-label="Limpiar filtros"
          @action="clearFilters"
        />
      </template>
    </TicketTable>
  </div>
</template>

<style scoped>
.inbox__header {
  margin-bottom: 24px;
}

.inbox__title {
  margin: 0;
  font-size: var(--font-size-24);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
}

.inbox__subtitle {
  margin: 6px 0 0;
  color: var(--color-text-muted);
}

.inbox__priorities {
  margin-bottom: 16px;
}

.inbox__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.inbox__search {
  width: 260px;
}

.inbox__count {
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}

.inbox__state {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.inbox__loading {
  margin: 0;
  padding: 64px 24px;
  color: var(--color-text-muted);
  text-align: center;
}
</style>
