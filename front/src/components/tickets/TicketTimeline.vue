<script setup lang="ts">
import type { AuditEvent } from '@/types/event'

import ChangeComparison from './ChangeComparison.vue'

defineProps<{
  events: AuditEvent[]
}>()

// Un evento con cambios se explica con la comparación; el texto repetiría lo mismo.
function detailOf(event: AuditEvent) {
  if (event.changes?.length) return ''
  if (event.type === 'Ticket resuelto' && event.detail)
    return `Tiempo de resolución ${event.detail}`
  return event.detail ?? ''
}
</script>

<template>
  <ol class="timeline">
    <li
      v-for="(event, index) in events"
      :key="event.id"
      class="timeline__event"
      :class="{
        'timeline__event--after-close': event.afterClose,
        'timeline__event--last': index === events.length - 1,
      }"
    >
      <time class="timeline__time" :datetime="event.time.replace(' ', 'T')">{{ event.time }}</time>
      <span class="timeline__dot" aria-hidden="true" />
      <div class="timeline__body">
        <div class="timeline__heading">
          <span class="timeline__type">{{ event.type }}</span>
          <span v-if="event.afterClose" class="timeline__badge">Edición posterior al cierre</span>
        </div>
        <div v-if="detailOf(event)" class="timeline__detail">{{ detailOf(event) }}</div>
        <ChangeComparison
          v-for="change in event.changes"
          :key="change.field"
          class="timeline__change"
          :change="change"
          :after-close="event.afterClose"
        />
        <div class="timeline__user">{{ event.user }}</div>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.timeline {
  margin: 0;
  padding: 0;
  list-style: none;
}

.timeline__event {
  display: grid;
  grid-template-columns: 150px 12px minmax(0, 1fr);
  gap: 14px;
  margin: 0 -12px;
  padding: 14px 12px;
  border-bottom: 1px solid var(--color-border-subtle);
  border-left: 3px solid transparent;
}

.timeline__event--last {
  border-bottom-color: transparent;
}

.timeline__event--after-close {
  background: var(--color-warning-tint);
  border-left-color: var(--color-warning);
}

.timeline__time {
  padding-top: 1px;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
  font-variant-numeric: tabular-nums;
}

.timeline__dot {
  width: 9px;
  height: 9px;
  margin-top: 6px;
  background: var(--color-accent-ring);
  border-radius: 50%;
}

.timeline__event--last .timeline__dot {
  background: var(--color-accent);
}

.timeline__event--after-close .timeline__dot {
  background: var(--color-warning);
}

.timeline__body {
  min-width: 0;
}

.timeline__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.timeline__type {
  font-size: var(--font-size-14);
  font-weight: var(--font-weight-medium);
}

.timeline__badge {
  display: inline-block;
  padding: 2px 8px;
  background: var(--color-warning-soft);
  border-radius: var(--radius-4);
  color: var(--color-warning);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.timeline__detail {
  margin-top: 3px;
  font-size: var(--font-size-13);
}

.timeline__change {
  margin-top: 8px;
}

.timeline__user {
  margin-top: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}
</style>
