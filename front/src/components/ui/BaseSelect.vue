<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'md' | 'sm'
    invalid?: boolean
  }>(),
  { size: 'md', invalid: false },
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <select
    v-model="model"
    class="select"
    :class="[`select--${size}`, { 'select--invalid': invalid }]"
    :aria-invalid="invalid || undefined"
  >
    <slot />
  </select>
</template>

<style scoped>
.select {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-6);
  color: var(--color-text);
}

.select--md {
  height: 40px;
  padding: 0 10px;
  font-size: var(--font-size-14);
}

.select--sm {
  height: 36px;
  padding: 0 8px;
  font-size: var(--font-size-13);
}

.select--invalid {
  border-color: var(--color-danger);
}
</style>
