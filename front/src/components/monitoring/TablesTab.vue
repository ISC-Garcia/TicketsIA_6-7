<script setup lang="ts">
import { computed, ref } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import SidePanel from '@/components/ui/SidePanel.vue'
import type { DatabaseTable } from '@/types/database'
import { formatNumber } from '@/utils/chart'
import { formatBytes } from '@/utils/format'

const props = defineProps<{
  tables: DatabaseTable[]
}>()

const selected = ref<DatabaseTable | null>(null)

const total = computed(() => props.tables.reduce((sum, table) => sum + table.sizeBytes, 0))

const stats = computed(() => {
  const table = selected.value
  if (!table) return []
  return [
    { label: 'Registros', value: formatNumber(table.rows) },
    { label: 'Tamaño', value: formatBytes(table.sizeBytes) },
    { label: 'Última modificación', value: table.modifiedAt ?? 'Sin datos' },
  ]
})
</script>

<template>
  <div class="tables">
    <div class="tables__card" role="table" aria-label="Tablas de la base de datos">
      <div role="rowgroup">
        <div role="row" class="tables__row tables__row--head">
          <span role="columnheader">Nombre</span>
          <span role="columnheader" class="tables__number">Registros</span>
          <span role="columnheader" class="tables__number">Tamaño</span>
          <span role="columnheader">Última modificación</span>
        </div>
      </div>
      <div role="rowgroup">
        <div
          v-for="table in tables"
          :key="table.name"
          role="row"
          class="tables__row"
          :class="{ 'tables__row--selected': selected?.name === table.name }"
          @click="selected = table"
        >
          <span role="cell">
            <button type="button" class="tables__open">{{ table.name }}</button>
          </span>
          <span role="cell" class="tables__number">{{ formatNumber(table.rows) }}</span>
          <span role="cell" class="tables__number">{{ formatBytes(table.sizeBytes) }}</span>
          <span role="cell" class="tables__muted">{{ table.modifiedAt ?? 'Sin datos' }}</span>
        </div>
      </div>
      <div role="rowgroup">
        <div role="row" class="tables__row tables__row--total">
          <span role="cell" class="tables__muted">Total</span>
          <span role="cell" />
          <span role="cell" class="tables__number tables__strong">{{ formatBytes(total) }}</span>
          <span role="cell" />
        </div>
      </div>
    </div>
    <p class="tables__hint">Selecciona una tabla para ver su descripción y sus columnas.</p>

    <SidePanel
      v-if="selected"
      :title="selected.name"
      subtitle="Tabla de la base de datos"
      @close="selected = null"
    >
      <p class="tables__description">{{ selected.description ?? 'Sin descripción.' }}</p>
      <dl class="tables__stats">
        <div v-for="stat in stats" :key="stat.label" class="tables__stat">
          <dt>{{ stat.label }}</dt>
          <dd>{{ stat.value }}</dd>
        </div>
      </dl>
      <h3 class="tables__columns-title">Columnas</h3>
      <table class="tables__columns">
        <thead>
          <tr>
            <th scope="col">Columna</th>
            <th scope="col">Tipo</th>
            <th scope="col">Descripción</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="column in selected.columns" :key="column.name">
            <td class="tables__column-name">{{ column.name }}</td>
            <td class="tables__muted">{{ column.type }}</td>
            <td class="tables__muted">{{ column.description ?? '—' }}</td>
          </tr>
        </tbody>
      </table>

      <template #footer>
        <span class="tables__read-only">Solo lectura</span>
        <BaseButton variant="secondary" @click="selected = null">Cerrar</BaseButton>
      </template>
    </SidePanel>
  </div>
</template>

<style scoped>
.tables {
  max-width: 1040px;
}

.tables__card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.tables__row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 160px 120px 200px;
  gap: 16px;
  align-items: center;
  height: 52px;
  padding: 0 24px;
  border-bottom: 1px solid var(--color-border-subtle);
  cursor: pointer;
  font-size: var(--font-size-13);
  font-variant-numeric: tabular-nums;
}

.tables__row:hover,
.tables__row--selected {
  background: var(--color-accent-soft);
}

.tables__row--head {
  height: auto;
  padding: 11px 24px;
  background: var(--color-surface-muted);
  border-bottom-color: var(--color-border);
  border-radius: var(--radius-8) var(--radius-8) 0 0;
  color: var(--color-text-muted);
  cursor: default;
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
}

.tables__row--total {
  height: auto;
  padding: 14px 24px;
  border-bottom: none;
  cursor: default;
}

.tables__row--head:hover,
.tables__row--total:hover {
  background: none;
}

.tables__row--head:hover {
  background: var(--color-surface-muted);
}

.tables__open {
  padding: 0;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-weight: var(--font-weight-medium);
}

.tables__number {
  text-align: right;
}

.tables__strong {
  font-weight: var(--font-weight-semibold);
}

.tables__muted {
  color: var(--color-text-muted);
}

.tables__hint {
  margin: 12px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.tables__description {
  margin: 0;
  font-size: var(--font-size-14);
  line-height: 1.6;
}

.tables__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 22px 0;
}

.tables__stat {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-6);
}

.tables__stat dt {
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.tables__stat dd {
  margin: 3px 0 0;
  font-size: var(--font-size-14);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-medium);
}

.tables__columns-title {
  margin: 0 0 8px;
  font-size: var(--font-size-13);
  font-weight: var(--font-weight-semibold);
}

.tables__columns {
  width: 100%;
  border: 1px solid var(--color-border);
  border-collapse: collapse;
  font-size: var(--font-size-13);
}

.tables__columns th,
.tables__columns td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--color-border-subtle);
  text-align: left;
  vertical-align: top;
}

.tables__columns th {
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
}

.tables__column-name {
  font-weight: var(--font-weight-medium);
  word-break: break-all;
}

.tables__read-only {
  margin-right: auto;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}
</style>
