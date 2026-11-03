<script setup lang="ts">
import { ref } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import { verifyIntegrity } from '@/services/database'
import { ServiceError } from '@/services/http'
import type { IntegrityReport } from '@/types/database'
import { formatNumber } from '@/utils/chart'

const report = ref<IntegrityReport | null>(null)
const checking = ref(false)
const error = ref('')

async function check() {
  checking.value = true
  error.value = ''
  try {
    report.value = await verifyIntegrity()
  } catch (cause) {
    if (!(cause instanceof ServiceError)) throw cause
    error.value = cause.message
  } finally {
    checking.value = false
  }
}

const altered = (count: number) => (count === 1 ? '1 alterado' : `${formatNumber(count)} alterados`)
</script>

<template>
  <section class="integrity" aria-labelledby="integrity-title">
    <header class="integrity__header">
      <div>
        <h2 id="integrity-title" class="integrity__title">Integridad de los datos</h2>
        <p class="integrity__limit">
          Cada ticket, evento y respaldo guarda su huella SHA-256. La verificación la recalcula y
          señala lo que se modificó por fuera del sistema. No detecta registros borrados.
        </p>
      </div>
      <BaseButton variant="secondary" size="sm" :disabled="checking" @click="check">
        {{ checking ? 'Verificando…' : 'Verificar integridad' }}
      </BaseButton>
    </header>

    <p v-if="error" class="integrity__error" role="alert">{{ error }}</p>
    <div v-else-if="report" class="integrity__result" aria-live="polite">
      <p class="integrity__checked">Verificado el {{ report.checkedAt }}</p>
      <ul class="integrity__list">
        <li
          v-for="table in report.tables"
          :key="table.name"
          class="integrity__item"
          :class="{ 'integrity__item--bad': table.mismatched }"
        >
          <span class="integrity__name">{{ table.name }}</span>
          <span class="integrity__muted">{{ formatNumber(table.verified) }} verificados</span>
          <span class="integrity__badge">
            {{ table.mismatched ? altered(table.mismatched) : 'Sin cambios' }}
          </span>
          <span v-if="table.examples.length" class="integrity__examples">
            {{ table.examples.join(', ') }}
          </span>
        </li>
        <li
          v-for="backup in report.backups"
          :key="backup.id"
          class="integrity__item"
          :class="{ 'integrity__item--bad': backup.result !== 'Íntegro' }"
        >
          <span class="integrity__name">{{ backup.fileName }}</span>
          <span class="integrity__muted">Respaldo del {{ backup.startedAt }}</span>
          <span class="integrity__badge">{{ backup.result }}</span>
        </li>
      </ul>
      <p v-if="!report.backups.length" class="integrity__muted">
        No hay respaldos exitosos en los últimos 7 días para revisar.
      </p>
    </div>
  </section>
</template>

<style scoped>
.integrity {
  margin-bottom: 16px;
  padding: 18px 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.integrity__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}

.integrity__title {
  margin: 0;
  font-size: var(--font-size-14);
  font-weight: var(--font-weight-semibold);
}

.integrity__limit {
  max-width: 640px;
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  line-height: 1.5;
}

.integrity__error {
  margin: 12px 0 0;
  color: var(--color-danger);
  font-size: var(--font-size-13);
}

.integrity__result {
  margin-top: 14px;
}

.integrity__checked {
  margin: 0 0 8px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.integrity__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.integrity__item {
  display: grid;
  grid-template-columns: 220px 220px auto;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
  border-top: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-13);
  font-variant-numeric: tabular-nums;
}

.integrity__name {
  overflow: hidden;
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.integrity__muted {
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}

.integrity__badge {
  justify-self: start;
  padding: 2px 8px;
  background: var(--color-accent-soft);
  border-radius: var(--radius-4);
  color: var(--color-accent);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
}

.integrity__item--bad .integrity__badge {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.integrity__examples {
  grid-column: 1 / -1;
  color: var(--color-danger);
  font-family: var(--font-mono);
  font-size: var(--font-size-12);
}
</style>
