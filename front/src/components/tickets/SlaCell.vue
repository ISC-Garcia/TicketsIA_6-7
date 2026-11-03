<script setup lang="ts">
import { computed } from 'vue'

import ProgressBar from '@/components/ui/ProgressBar.vue'
import type { Priority } from '@/types/ticket'
import { formatMinutes } from '@/utils/format'
import { slaOf, type SlaState } from '@/utils/sla'

const props = defineProps<{
  priority: Priority
  ageMinutes: number
  resolutionHours?: number
}>()

const LABELS: Partial<Record<SlaState, string>> = {
  overdue: 'Vencido',
  met: 'Cumplido',
  missed: 'Incumplido',
}

const BAR_COLORS: Record<SlaState, string> = {
  normal: 'var(--color-accent)',
  risk: 'var(--color-warning)',
  overdue: 'var(--color-danger)',
  met: 'var(--color-accent-ring)',
  missed: 'var(--color-danger)',
}

const sla = computed(() => slaOf(props.priority, props.ageMinutes, props.resolutionHours))
const text = computed(() => LABELS[sla.value.state] ?? formatMinutes(sla.value.remainingMinutes))
// Como en el prototipo, la barra de un ticket resuelto aparece completa.
const percent = computed(() => (props.resolutionHours === undefined ? sla.value.percent : 100))
</script>

<template>
  <div class="sla" :class="`sla--${sla.state}`">
    <span class="sla__text">{{ text }}</span>
    <ProgressBar
      :value="percent"
      :height="2"
      :color="BAR_COLORS[sla.state]"
      label="SLA consumido"
    />
  </div>
</template>

<style scoped>
.sla {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.sla__text {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.sla--risk .sla__text {
  color: var(--color-warning);
  font-weight: var(--font-weight-semibold);
}

.sla--overdue .sla__text,
.sla--missed .sla__text {
  color: var(--color-danger);
  font-weight: var(--font-weight-semibold);
}
</style>
