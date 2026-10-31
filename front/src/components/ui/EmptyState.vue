<script setup lang="ts">
import BaseButton from './BaseButton.vue'

defineProps<{
  title: string
  actionLabel?: string
}>()

defineEmits<{ action: [] }>()
</script>

<template>
  <div class="empty">
    <div class="empty__title">{{ title }}</div>
    <div v-if="$slots.default" class="empty__text"><slot /></div>
    <BaseButton v-if="actionLabel" variant="link" class="empty__action" @click="$emit('action')">
      {{ actionLabel }}
    </BaseButton>
  </div>
</template>

<style scoped>
.empty {
  padding: 64px 24px;
  text-align: center;
}

.empty__title {
  font-size: var(--font-size-15);
  font-weight: var(--font-weight-medium);
}

.empty__text {
  margin-top: 6px;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}

.empty__action {
  margin-top: 10px;
}
</style>
