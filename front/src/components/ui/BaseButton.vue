<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'link'
    size?: 'lg' | 'md' | 'sm' | 'xs'
    type?: 'button' | 'submit' | 'reset'
    block?: boolean
  }>(),
  { variant: 'primary', size: 'md', type: 'button', block: false },
)
</script>

<template>
  <button
    :type="type"
    class="button"
    :class="[`button--${size}`, `button--${variant}`, { 'button--block': block }]"
  >
    <slot />
  </button>
</template>

<style scoped>
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-6);
  cursor: pointer;
  white-space: nowrap;
}

.button--block {
  width: 100%;
}

.button--lg {
  height: 40px;
  padding: 0 18px;
  font-size: var(--font-size-14);
}

.button--md {
  height: 38px;
  padding: 0 16px;
  font-size: var(--font-size-14);
}

.button--sm {
  height: 32px;
  padding: 0 14px;
  font-size: var(--font-size-13);
}

.button--xs {
  height: 30px;
  padding: 0 10px;
  border-radius: var(--radius-5);
  font-size: var(--font-size-12);
}

.button--primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-text-inverse);
  font-weight: var(--font-weight-medium);
}

.button--primary:hover:not(:disabled),
.button--primary:active:not(:disabled) {
  background: var(--color-accent-hover);
}

.button--secondary {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text);
}

.button--secondary:hover:not(:disabled) {
  background: var(--color-bg);
}

.button--danger {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: var(--color-text-inverse);
  font-weight: var(--font-weight-medium);
}

.button--link {
  height: auto;
  padding: 0;
  background: none;
  border: none;
  border-radius: 0;
  color: var(--color-accent);
  font-size: var(--font-size-13);
}

.button--link:hover:not(:disabled) {
  color: var(--color-accent-hover);
  text-decoration: underline;
}
</style>
