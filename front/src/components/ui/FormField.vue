<script setup lang="ts">
import { computed, useId } from 'vue'

const props = defineProps<{
  label: string
  error?: string
  hint?: string
  optional?: boolean
}>()

const id = useId()
const hintId = `${id}-hint`
const errorId = `${id}-error`

const describedBy = computed(
  () => [props.hint && hintId, props.error && errorId].filter(Boolean).join(' ') || undefined,
)
</script>

<template>
  <div class="field">
    <label :for="id" class="field__label">
      {{ label }}
      <span v-if="optional" class="field__optional">(opcional)</span>
    </label>
    <slot :id="id" :invalid="Boolean(error)" :described-by="describedBy" />
    <span v-if="hint" :id="hintId" class="field__hint">{{ hint }}</span>
    <span v-if="error" :id="errorId" role="alert" class="field__error">{{ error }}</span>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field__label {
  font-size: var(--font-size-13);
  font-weight: var(--font-weight-medium);
}

.field__optional {
  color: var(--color-text-muted);
  font-weight: var(--font-weight-regular);
}

.field__hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.field__error {
  color: var(--color-danger);
  font-size: var(--font-size-12);
}
</style>
