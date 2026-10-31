<script setup lang="ts"></script>

<template>
  <main class="placeholder">
    <h1 class="placeholder__title">{{ $route.meta.title }}</h1>
  </main>
</template>

<style scoped>
.placeholder {
  padding: 36px 40px 48px;
}

.placeholder__title {
  margin: 0;
  font-size: var(--font-size-24);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
}
</style>
