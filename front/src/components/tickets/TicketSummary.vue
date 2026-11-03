<script setup lang="ts">
import { computed } from 'vue'

import type { Ticket } from '@/types/ticket'
import { minutesSince } from '@/utils/clock'
import { formatMinutes } from '@/utils/format'
import { highlightText } from '@/utils/highlight'

const props = defineProps<{
  ticket: Ticket
}>()

const segments = computed(() => highlightText(props.ticket.description, props.ticket.highlights))

const details = computed(() => {
  const { ticket } = props
  const rows = [
    ['Área solicitante', ticket.area],
    ['Reportado por', ticket.reporter],
    ['Dispositivo afectado', ticket.device],
    ['Departamento', ticket.department],
    ['Técnico asignado', ticket.technician],
    ['Fecha de registro', ticket.createdAt],
    ['Antigüedad', formatMinutes(minutesSince(ticket.createdAt))],
  ]
  if (ticket.resolutionHours !== undefined) {
    rows.push(['Tiempo de resolución', `${ticket.resolutionHours.toFixed(2)} h`])
  }
  return rows
})
</script>

<template>
  <div class="summary">
    <section class="summary__card summary__description" aria-labelledby="summary-description">
      <h2 id="summary-description" class="summary__label">Descripción del problema</h2>
      <p class="summary__text">
        <template v-for="(segment, index) in segments" :key="index">
          <mark v-if="segment.highlighted" class="summary__entity">{{ segment.text }}</mark>
          <template v-else>{{ segment.text }}</template>
        </template>
      </p>
      <div class="summary__legend">
        <span class="summary__swatch" aria-hidden="true" />
        Entidades detectadas por el análisis de lenguaje
      </div>
    </section>

    <dl class="summary__card summary__details">
      <div v-for="[label, value] in details" :key="label" class="summary__row">
        <dt class="summary__term">{{ label }}</dt>
        <dd class="summary__value">{{ value }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  align-items: start;
  gap: 24px;
}

.summary__card {
  margin: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.summary__description {
  padding: 24px 28px;
}

.summary__label {
  margin: 0 0 12px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-regular);
}

.summary__text {
  max-width: 68ch;
  margin: 0;
  font-size: var(--font-size-16);
  line-height: 1.7;
  text-wrap: pretty;
}

.summary__entity {
  padding: 1px 2px;
  background: var(--color-accent-soft);
  border-bottom: 1px solid var(--color-accent-ring);
  color: inherit;
}

.summary__legend {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border-subtle);
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.summary__swatch {
  width: 14px;
  height: 10px;
  background: var(--color-accent-soft);
  border-bottom: 1px solid var(--color-accent-ring);
}

.summary__details {
  padding: 8px 20px;
}

.summary__row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 0;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-13);
}

.summary__row:last-child {
  border-bottom-color: transparent;
}

.summary__term {
  flex: none;
  color: var(--color-text-muted);
}

.summary__value {
  margin: 0;
  text-align: right;
}
</style>
