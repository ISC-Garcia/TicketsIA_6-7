<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    label: string
    height?: number
    color?: string
  }>(),
  { height: 4, color: 'var(--color-accent)' },
)

const percent = computed(() => Math.round(Math.min(100, Math.max(0, props.value))))
</script>

<template>
  <div
    role="progressbar"
    class="progress"
    :style="{ height: `${height}px` }"
    :aria-label="label"
    :aria-valuenow="percent"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div class="progress__fill" :style="{ width: `${percent}%`, background: color }" />
  </div>
</template>

<style scoped>
.progress {
  overflow: hidden;
  background: var(--color-border-subtle);
  border-radius: var(--radius-2);
}

.progress__fill {
  height: 100%;
}
</style>
