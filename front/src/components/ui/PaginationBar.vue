<script setup lang="ts">
import { computed } from 'vue'

import BaseButton from './BaseButton.vue'

const props = defineProps<{
  pageSize: number
  total: number
}>()

const page = defineModel<number>('page', { required: true })

const lastPage = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const firstItem = computed(() => (page.value - 1) * props.pageSize + 1)
const lastItem = computed(() => Math.min(props.total, page.value * props.pageSize))
</script>

<template>
  <nav aria-label="Paginación" class="pagination">
    <span>Mostrando {{ firstItem }} a {{ lastItem }} de {{ total }}</span>
    <div class="pagination__actions">
      <BaseButton variant="secondary" size="sm" :disabled="page <= 1" @click="page -= 1">
        Anterior
      </BaseButton>
      <BaseButton variant="secondary" size="sm" :disabled="page >= lastPage" @click="page += 1">
        Siguiente
      </BaseButton>
    </div>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}

.pagination__actions {
  display: flex;
  gap: 8px;
}
</style>
