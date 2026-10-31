<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const session = useSessionStore()

const confirmingLogout = ref(false)

async function logout() {
  confirmingLogout.value = false
  session.signOut()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div v-if="session.user" class="layout">
    <AppSidebar :user="session.user" @logout="confirmingLogout = true" />
    <div class="layout__content">
      <AppHeader :read-only="session.user.role === 'auditor'" />
      <main class="layout__main">
        <RouterView />
      </main>
    </div>
    <ConfirmDialog
      v-if="confirmingLogout"
      title="¿Deseas cerrar sesión?"
      confirm-label="Cerrar sesión"
      @confirm="logout"
      @cancel="confirmingLogout = false"
    />
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.layout__content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.layout__main {
  flex: 1;
  padding: 36px 40px 48px;
  overflow: auto;
}
</style>
