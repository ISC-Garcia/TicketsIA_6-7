<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'md' | 'sm'
    invalid?: boolean
    mono?: boolean
  }>(),
  { size: 'md', invalid: false, mono: false },
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <input
    v-model="model"
    class="input"
    :class="[`input--${size}`, { 'input--invalid': invalid, 'input--mono': mono }]"
    :aria-invalid="invalid || undefined"
  />
</template>

<style scoped>
.input {
  width: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-6);
  color: var(--color-text);
}

.input--md {
  height: 40px;
  padding: 0 12px;
  font-size: var(--font-size-14);
}

.input--sm {
  height: 36px;
  padding: 0 12px;
  font-size: var(--font-size-13);
}

.input--invalid {
  border-color: var(--color-danger);
}

.input--mono {
  font-family: var(--font-mono);
}
</style>
