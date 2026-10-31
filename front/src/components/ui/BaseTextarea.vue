<script setup lang="ts">
withDefaults(defineProps<{ invalid?: boolean }>(), { invalid: false })

const model = defineModel<string>({ default: '' })
</script>

<template>
  <textarea
    v-model="model"
    class="textarea"
    :class="{ 'textarea--invalid': invalid }"
    :aria-invalid="invalid || undefined"
  />
</template>

<style scoped>
.textarea {
  width: 100%;
  padding: 10px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-6);
  color: var(--color-text);
  font-size: var(--font-size-14);
  line-height: 1.55;
  resize: vertical;
}

.textarea--invalid {
  border-color: var(--color-danger);
}
</style>
