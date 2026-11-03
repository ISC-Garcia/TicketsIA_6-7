<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ChangeComparison from '@/components/tickets/ChangeComparison.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import SidePanel from '@/components/ui/SidePanel.vue'
import { ServiceError } from '@/services/http'
import { getTicket } from '@/services/tickets'
import type { AuditEvent } from '@/types/event'

const props = defineProps<{
  event: AuditEvent
}>()

const emit = defineEmits<{ close: []; history: [ticketId: string] }>()

const resolvedAt = ref('')

// La fecha de cierre sale del ticket: explica por qué la edición es posterior.
watch(
  () => props.event,
  async (event) => {
    resolvedAt.value = ''
    if (!event.afterClose || !event.ticketId) return
    try {
      resolvedAt.value = (await getTicket(event.ticketId))?.resolvedAt ?? ''
    } catch (cause) {
      if (!(cause instanceof ServiceError)) throw cause
    }
  },
  { immediate: true },
)

const rows = computed(() => {
  const event = props.event
  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Fecha y hora', value: event.time },
    { label: 'Usuario', value: event.user },
    { label: 'Tipo de evento', value: event.type },
  ]
  if (event.ticketId) rows.push({ label: 'Ticket', value: event.ticketId, mono: true })
  if (event.detail && !event.changes?.length) {
    rows.push({
      label: 'Detalle',
      value:
        event.type === 'Ticket resuelto' ? `Tiempo de resolución ${event.detail}` : event.detail,
    })
  }
  if (event.solution) rows.push({ label: 'Solución aplicada', value: event.solution })
  return rows
})

const afterCloseNote = computed(() =>
  resolvedAt.value
    ? `Edición posterior al cierre. El ticket se resolvió el ${resolvedAt.value} y este cambio se hizo después.`
    : 'Edición posterior al cierre del ticket.',
)
</script>

<template>
  <SidePanel :title="event.type" :subtitle="event.time" @close="emit('close')">
    <p v-if="event.afterClose" class="event__after-close">{{ afterCloseNote }}</p>
    <dl class="event__rows">
      <div v-for="row in rows" :key="row.label" class="event__row">
        <dt>{{ row.label }}</dt>
        <dd :class="{ event__mono: row.mono }">{{ row.value }}</dd>
      </div>
    </dl>
    <template v-if="event.changes?.length">
      <h3 class="event__changes-title">Campos modificados</h3>
      <ChangeComparison
        v-for="change in event.changes"
        :key="change.field"
        :change="change"
        :after-close="event.afterClose"
        class="event__change"
      />
    </template>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cerrar</BaseButton>
      <BaseButton v-if="event.ticketId" @click="emit('history', event.ticketId)">
        Ver historial del ticket
      </BaseButton>
    </template>
  </SidePanel>
</template>

<style scoped>
.event__after-close {
  margin: 0 0 8px;
  padding: 10px 12px;
  background: var(--color-warning-soft);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-6);
  color: var(--color-warning);
  font-size: var(--font-size-13);
  line-height: 1.5;
}

.event__rows {
  margin: 0;
}

.event__row {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-13);
}

.event__row dt {
  color: var(--color-text-muted);
}

.event__row dd {
  margin: 0;
  line-height: 1.5;
}

.event__mono {
  font-family: var(--font-mono);
}

.event__changes-title {
  margin: 22px 0 10px;
  font-size: var(--font-size-13);
  font-weight: var(--font-weight-semibold);
}

.event__change {
  margin-bottom: 12px;
}
</style>
