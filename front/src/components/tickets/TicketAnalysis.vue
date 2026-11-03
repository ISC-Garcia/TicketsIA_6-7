<script setup lang="ts">
import { computed } from 'vue'

import PriorityBadge from '@/components/ui/PriorityBadge.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import type { Priority, Ticket } from '@/types/ticket'

const props = defineProps<{
  ticket: Ticket
}>()

// De mayor a menor; la clase ganadora se distingue con el color fuerte.
const probabilities = computed(() =>
  (Object.entries(props.ticket.analysis.probabilities) as [Priority, number][]).sort(
    (a, b) => b[1] - a[1],
  ),
)
</script>

<template>
  <div class="analysis">
    <div class="analysis__column analysis__column--model">
      <div>
        <div class="analysis__label">Prioridad asignada</div>
        <div class="analysis__assigned">
          <PriorityBadge :priority="ticket.priority" size="lg" />
          <span class="analysis__muted">{{ ticket.analysis.confidence }} % de confianza</span>
        </div>
      </div>
      <div>
        <div class="analysis__label analysis__label--spaced">Probabilidad por clase</div>
        <div class="analysis__probabilities">
          <div
            v-for="([priority, value], index) in probabilities"
            :key="priority"
            class="analysis__probability"
          >
            <span>{{ priority }}</span>
            <ProgressBar
              :value="value"
              :height="8"
              :color="index === 0 ? 'var(--color-accent)' : 'var(--color-accent-ring)'"
              :label="`Probabilidad de ${priority}`"
            />
            <span class="analysis__percent">{{ value }} %</span>
          </div>
        </div>
      </div>
    </div>

    <div class="analysis__column">
      <dl class="analysis__facts">
        <div>
          <dt class="analysis__label">Departamento sugerido</dt>
          <dd class="analysis__fact">{{ ticket.department }}</dd>
        </div>
        <div>
          <dt class="analysis__label">Sentimiento</dt>
          <dd class="analysis__fact">{{ ticket.analysis.sentiment }}</dd>
        </div>
        <div>
          <dt class="analysis__label">Intención</dt>
          <dd class="analysis__fact">{{ ticket.analysis.intent }}</dd>
        </div>
      </dl>

      <div class="analysis__section">
        <div class="analysis__label">Entidades detectadas</div>
        <div class="analysis__entity-row">
          <span class="analysis__muted">Dispositivos</span>
          <ul class="analysis__chips">
            <li v-for="device in ticket.analysis.devices" :key="device" class="analysis__chip">
              {{ device }}
            </li>
          </ul>
        </div>
        <div class="analysis__entity-row">
          <span class="analysis__muted">Códigos de error</span>
          <ul class="analysis__chips">
            <li
              v-for="code in ticket.analysis.errorCodes"
              :key="code"
              class="analysis__chip analysis__chip--mono"
            >
              {{ code }}
            </li>
            <li v-if="!ticket.analysis.errorCodes.length" class="analysis__muted">Ninguno</li>
          </ul>
        </div>
      </div>

      <div class="analysis__section">
        <div class="analysis__label analysis__label--spaced">Palabras clave</div>
        <ul class="analysis__chips">
          <li v-for="keyword in ticket.analysis.keywords" :key="keyword" class="analysis__keyword">
            {{ keyword }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analysis {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.analysis__column {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 28px;
}

.analysis__column--model {
  gap: 28px;
  border-right: 1px solid var(--color-border-subtle);
}

.analysis__label {
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.analysis__label--spaced {
  margin-bottom: 10px;
}

.analysis__muted {
  color: var(--color-text-muted);
}

.analysis__assigned {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.analysis__probabilities {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.analysis__probability {
  display: grid;
  grid-template-columns: 64px 1fr 44px;
  align-items: center;
  gap: 12px;
  font-size: var(--font-size-13);
}

.analysis__percent {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.analysis__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin: 0;
}

.analysis__facts .analysis__label {
  margin-bottom: 4px;
}

.analysis__fact {
  margin: 0;
  font-weight: var(--font-weight-medium);
}

.analysis__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border-subtle);
}

.analysis__entity-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: center;
  gap: 10px;
  font-size: var(--font-size-13);
}

.analysis__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.analysis__chip {
  padding: 3px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-4);
}

.analysis__chip--mono {
  font-family: var(--font-mono);
  font-size: var(--font-size-12);
}

.analysis__keyword {
  padding: 3px 8px;
  background: var(--color-fill);
  border-radius: var(--radius-4);
  font-size: var(--font-size-13);
}
</style>
