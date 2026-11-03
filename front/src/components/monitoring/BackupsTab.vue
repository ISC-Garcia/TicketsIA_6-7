<script setup lang="ts">
import type { Backup } from '@/types/database'
import { formatBytes, formatDuration } from '@/utils/format'

defineProps<{
  backups: Backup[]
}>()
</script>

<template>
  <section class="backups" aria-labelledby="backups-title">
    <header class="backups__header">
      <h2 id="backups-title" class="backups__title">Respaldos</h2>
      <p class="backups__subtitle">
        Respaldos completos con pg_dump ejecutados en los últimos 7 días, del más reciente al más
        antiguo. Se crean con <code>uv run python -m app.cli backup</code>.
      </p>
    </header>
    <p v-if="!backups.length" class="backups__empty">
      No se ha ejecutado ningún respaldo en los últimos 7 días.
    </p>
    <table v-else class="backups__table">
      <thead>
        <tr>
          <th scope="col">Fecha</th>
          <th scope="col" class="backups__number">Tamaño</th>
          <th scope="col" class="backups__number">Duración</th>
          <th scope="col">Estado</th>
          <th scope="col">Detalle</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="backup in backups"
          :key="backup.id"
          :class="{ 'backups__row--retry': backup.retryOfId }"
        >
          <td class="backups__date">
            {{ backup.startedAt }}
            <span v-if="backup.retryOfId" class="backups__retry">Reintento</span>
          </td>
          <td class="backups__number">
            {{ backup.sizeBytes === undefined ? '—' : formatBytes(backup.sizeBytes) }}
          </td>
          <td class="backups__number backups__muted">
            {{ formatDuration(backup.durationSeconds) }}
          </td>
          <td>
            <span
              class="backups__status"
              :class="backup.status === 'Fallido' ? 'backups__status--failed' : ''"
            >
              {{ backup.status }}
            </span>
          </td>
          <td
            class="backups__detail"
            :class="{ 'backups__detail--failed': backup.status === 'Fallido' }"
            :title="backup.sha256 ? `SHA-256 ${backup.sha256}` : backup.detail"
          >
            {{ backup.sha256 ? `SHA-256 ${backup.sha256.slice(0, 16)}…` : backup.detail }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.backups {
  max-width: 1040px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.backups__header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-border);
}

.backups__title {
  margin: 0;
  font-size: var(--font-size-14);
  font-weight: var(--font-weight-semibold);
}

.backups__subtitle {
  margin: 2px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.backups__subtitle code {
  font-family: var(--font-mono);
}

.backups__empty {
  margin: 0;
  padding: 24px;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}

.backups__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-13);
  font-variant-numeric: tabular-nums;
}

.backups__table th,
.backups__table td {
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-border-subtle);
  text-align: left;
}

.backups__table th:first-child,
.backups__table td:first-child {
  padding-left: 24px;
}

.backups__table tr:last-child td {
  border-bottom: none;
}

.backups__table th {
  height: auto;
  padding-top: 10px;
  padding-bottom: 10px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
}

.backups__number {
  text-align: right !important;
}

.backups__muted {
  color: var(--color-text-muted);
}

/* El reintento se sangra bajo el respaldo fallido que repite. */
.backups__row--retry .backups__date {
  padding-left: 40px !important;
  color: var(--color-text-muted);
}

.backups__retry {
  margin-left: 6px;
  font-size: var(--font-size-12);
}

.backups__status {
  display: inline-block;
  padding: 2px 8px;
  background: var(--color-accent-soft);
  border-radius: var(--radius-4);
  color: var(--color-accent);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
}

.backups__status--failed {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.backups__detail {
  max-width: 360px;
  overflow: hidden;
  color: var(--color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.backups__detail--failed {
  color: var(--color-danger);
}
</style>
