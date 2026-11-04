<script setup lang="ts">
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { computed } from 'vue'

import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useNow } from '@/composables/useNow'
import { formatLongDate } from '@/utils/format'

defineProps<{ readOnly: boolean }>()

const breadcrumbs = useBreadcrumbs()
const current = useNow()
const today = computed(() => formatLongDate(current.value))
</script>

<template>
  <header class="header">
    <nav aria-label="Ruta" class="header__breadcrumbs">
      <template v-for="(crumb, index) in breadcrumbs" :key="crumb.label">
        <RouterLink v-if="crumb.to" :to="crumb.to" class="header__crumb">
          {{ crumb.label }}
        </RouterLink>
        <span
          v-else
          class="header__crumb header__crumb--current"
          :class="{ 'header__crumb--mono': crumb.mono }"
          aria-current="page"
        >
          {{ crumb.label }}
        </span>
        <span v-if="index < breadcrumbs.length - 1" class="header__separator" aria-hidden="true">
          /
        </span>
      </template>
    </nav>
    <div class="header__meta">
      <BaseBadge v-if="readOnly" class="header__mode">Modo solo lectura</BaseBadge>
      <div class="header__date">{{ today }}</div>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 40px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.header__breadcrumbs {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: var(--font-size-13);
}

.header__crumb {
  color: var(--color-text-muted);
  white-space: nowrap;
}

.header__crumb:hover {
  color: var(--color-accent);
  text-decoration: none;
}

.header__crumb--current,
.header__crumb--current:hover {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.header__crumb--mono {
  font-family: var(--font-mono);
}

.header__separator {
  color: var(--color-border-strong);
}

.header__meta {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header .header__mode {
  color: var(--color-text-muted);
}

.header__date {
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}
</style>
