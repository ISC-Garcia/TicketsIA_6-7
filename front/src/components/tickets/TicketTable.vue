<script setup lang="ts">
import { useRouter } from 'vue-router'

import PriorityBadge from '@/components/ui/PriorityBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { Ticket } from '@/types/ticket'
import { minutesSince } from '@/utils/clock'
import { formatMinutes } from '@/utils/format'

import RowActions from './RowActions.vue'
import SlaCell from './SlaCell.vue'

const props = withDefaults(
  defineProps<{
    tickets: Ticket[]
    busy?: boolean
    // El coordinador ve el técnico asignado y puede reasignar; el técnico ve el área.
    mode?: 'tecnico' | 'coordinador'
  }>(),
  { busy: false, mode: 'tecnico' },
)

defineEmits<{ reassign: [ticket: Ticket] }>()

const router = useRouter()

const coordinator = () => props.mode === 'coordinador'
const detailRoute = (id: string) => ({
  name: coordinator() ? 'general-detalle' : 'bandeja-detalle',
  params: { id },
})

// Como en el prototipo, la columna muestra solo nombre y primer apellido.
const shortName = (name?: string) => (name ? name.split(' ').slice(0, 2).join(' ') : 'Sin asignar')

// Con el ratón se abre desde cualquier parte de la fila; con teclado, desde el enlace del ID.
// Los controles de la fila, como el menú de acciones, no abren el detalle.
function openRow(event: MouseEvent, id: string) {
  if ((event.target as Element).closest('a, [data-row-actions]')) return
  router.push(detailRoute(id))
}
</script>

<template>
  <div class="tickets">
    <div role="table" aria-label="Tickets" :aria-busy="busy || undefined">
      <div role="rowgroup">
        <div role="row" class="tickets__row tickets__row--head" :class="`tickets__row--${mode}`">
          <span role="columnheader">ID</span>
          <span role="columnheader">Prioridad</span>
          <span role="columnheader">Resumen</span>
          <span v-if="mode === 'tecnico'" role="columnheader">Área</span>
          <span role="columnheader">Departamento</span>
          <span v-if="mode === 'coordinador'" role="columnheader">Técnico asignado</span>
          <span role="columnheader">Estado</span>
          <span role="columnheader">Antigüedad</span>
          <span role="columnheader" title="Tiempo restante de SLA">Tiempo restante de SLA</span>
          <span v-if="mode === 'coordinador'" role="columnheader"
            ><span class="tickets__hidden">Acciones</span></span
          >
        </div>
      </div>
      <div role="rowgroup">
        <div
          v-for="ticket in tickets"
          :key="ticket.id"
          role="row"
          class="tickets__row"
          :class="`tickets__row--${mode}`"
          @click="openRow($event, ticket.id)"
        >
          <span role="cell">
            <RouterLink :to="detailRoute(ticket.id)" class="tickets__id">{{
              ticket.id
            }}</RouterLink>
          </span>
          <span role="cell"><PriorityBadge :priority="ticket.priority" /></span>
          <span role="cell" class="tickets__truncate" :title="ticket.description">
            {{ ticket.summary }}
          </span>
          <span v-if="mode === 'tecnico'" role="cell" class="tickets__truncate tickets__muted">
            {{ ticket.area }}
          </span>
          <span role="cell" class="tickets__truncate tickets__muted" :title="ticket.department">
            {{ ticket.department }}
          </span>
          <span
            v-if="mode === 'coordinador'"
            role="cell"
            class="tickets__truncate"
            :title="ticket.technician"
          >
            {{ shortName(ticket.technician) }}
          </span>
          <span role="cell"><StatusBadge :status="ticket.status" /></span>
          <span role="cell" class="tickets__muted tickets__number">
            {{ formatMinutes(minutesSince(ticket.createdAt)) }}
          </span>
          <span role="cell">
            <SlaCell
              :priority="ticket.priority"
              :age-minutes="minutesSince(ticket.createdAt)"
              :resolution-hours="ticket.resolutionHours"
            />
          </span>
          <span v-if="mode === 'coordinador'" role="cell" data-row-actions>
            <RowActions
              v-if="ticket.status !== 'Resuelto'"
              :ticket-id="ticket.id"
              @reassign="$emit('reassign', ticket)"
            />
          </span>
        </div>
      </div>
    </div>
    <slot v-if="!tickets.length" name="empty" />
  </div>
</template>

<style scoped>
.tickets {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.tickets__row {
  display: grid;
  grid-template-columns:
    112px 84px minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 1.3fr)
    100px 92px 136px;
  align-items: center;
  gap: 14px;
  height: 52px;
  padding: 0 20px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-13);
  cursor: pointer;
}

.tickets__row--coordinador {
  grid-template-columns:
    104px 80px minmax(0, 2.2fr) minmax(0, 1.4fr) 132px
    96px 84px 124px 40px;
}

.tickets__row:hover:not(.tickets__row--head) {
  background: var(--color-accent-soft);
}

.tickets__row--head {
  height: auto;
  padding: 11px 20px;
  background: var(--color-surface-muted);
  border-bottom-color: var(--color-border);
  border-radius: var(--radius-8) var(--radius-8) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
  cursor: default;
}

.tickets__row--head > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tickets__id {
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--font-size-12-5);
}

.tickets__truncate {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tickets__muted {
  color: var(--color-text-muted);
}

.tickets__hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.tickets__number {
  font-variant-numeric: tabular-nums;
}
</style>
