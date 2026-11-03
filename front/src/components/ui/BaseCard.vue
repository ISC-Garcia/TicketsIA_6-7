<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    padding?: 'none' | 'md' | 'lg'
  }>(),
  { padding: 'md' },
)
</script>

<template>
  <section class="card" :class="`card--${padding}`">
    <h2 v-if="title" class="card__title">{{ title }}</h2>
    <p v-if="subtitle" class="card__subtitle">{{ subtitle }}</p>
    <slot />
  </section>
</template>

<style scoped>
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.card--md {
  padding: 22px 24px;
}

.card--lg {
  padding: 24px 28px;
}

.card__title {
  margin: 0;
  font-size: var(--font-size-14);
  font-weight: var(--font-weight-semibold);
}

.card__subtitle {
  margin: 2px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}
</style>
