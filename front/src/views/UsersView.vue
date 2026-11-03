<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import NewUserPanel from '@/components/users/NewUserPanel.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { ICONS } from '@/constants/icons'
import { ROLE_MENUS } from '@/constants/roles'
import { ServiceError } from '@/services/http'
import { listUsers, setUserActive } from '@/services/users'
import { useSessionStore } from '@/stores/session'
import { useToastStore } from '@/stores/toast'
import type { User } from '@/types/user'

const session = useSessionStore()
const toast = useToastStore()

const users = ref<User[]>([])
const loading = ref(true)
const error = ref('')
const creating = ref(false)
const deactivating = ref<User | null>(null)
const busy = ref('')
const actionError = ref('')

const activeCount = computed(() => users.value.filter((user) => user.active).length)
const summary = computed(() => `${activeCount.value} usuarios activos de ${users.value.length}`)
const usernames = computed(() => users.value.map((user) => user.username))
// El coordinador no puede desactivarse a sí mismo: su fila dice "Sesión actual".
const isSelf = (user: User) => user.username === session.user?.username

async function load() {
  loading.value = true
  error.value = ''
  try {
    users.value = await listUsers()
  } catch (cause) {
    if (!(cause instanceof ServiceError)) throw cause
    error.value = cause.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

function replace(updated: User) {
  users.value = users.value.map((user) => (user.username === updated.username ? updated : user))
}

async function setActive(user: User, active: boolean) {
  deactivating.value = null
  busy.value = user.username
  actionError.value = ''
  try {
    replace(await setUserActive(user.username, active))
    toast.show(active ? 'Usuario reactivado' : 'Usuario desactivado', user.name)
  } catch (cause) {
    if (!(cause instanceof ServiceError)) throw cause
    actionError.value = cause.message
  } finally {
    busy.value = ''
  }
}

function onCreated(user: User) {
  creating.value = false
  users.value = [...users.value, user]
  toast.show('Usuario creado', `${user.name}, ${ROLE_MENUS[user.role].label}`)
}
</script>

<template>
  <div class="users">
    <header class="users__header">
      <div>
        <h1 class="users__title">Gestión de usuarios</h1>
        <p class="users__subtitle">{{ loading && !users.length ? 'Cargando…' : summary }}</p>
      </div>
      <BaseButton @click="creating = true">
        <BaseIcon :path="ICONS.add" :size="16" />
        Nuevo usuario
      </BaseButton>
    </header>

    <EmptyState v-if="error" :title="error" action-label="Reintentar" @action="load" />
    <div v-else class="users__table" role="table" aria-label="Usuarios">
      <div role="rowgroup">
        <div role="row" class="users__row users__row--head">
          <span role="columnheader">Nombre</span>
          <span role="columnheader">Usuario</span>
          <span role="columnheader">Rol</span>
          <span role="columnheader">Estado</span>
          <span role="columnheader"><span class="users__hidden">Acciones</span></span>
        </div>
      </div>
      <div role="rowgroup">
        <div
          v-for="user in users"
          :key="user.username"
          role="row"
          class="users__row"
          :class="{ 'users__row--inactive': !user.active }"
        >
          <span role="cell" class="users__name">{{ user.name }}</span>
          <span role="cell" class="users__username">{{ user.username }}</span>
          <span role="cell">
            <BaseBadge :tone="user.active ? 'neutral' : 'muted'">
              {{ ROLE_MENUS[user.role].label }}
            </BaseBadge>
          </span>
          <span role="cell">
            <BaseBadge :tone="user.active ? 'success' : 'muted'">
              {{ user.active ? 'Activo' : 'Inactivo' }}
            </BaseBadge>
          </span>
          <span role="cell" class="users__actions">
            <span v-if="isSelf(user)" class="users__self">Sesión actual</span>
            <BaseButton
              v-else-if="user.active"
              variant="secondary"
              size="xs"
              :disabled="busy === user.username"
              @click="deactivating = user"
            >
              Desactivar
            </BaseButton>
            <BaseButton
              v-else
              variant="secondary"
              size="xs"
              class="users__reactivate"
              :disabled="busy === user.username"
              @click="setActive(user, true)"
            >
              Reactivar
            </BaseButton>
          </span>
        </div>
      </div>
    </div>
    <p v-if="actionError" class="users__error" role="alert">{{ actionError }}</p>

    <NewUserPanel
      v-if="creating"
      :existing="usernames"
      @close="creating = false"
      @created="onCreated"
    />
    <ConfirmDialog
      v-if="deactivating"
      :title="`¿Desactivar a ${deactivating.name}?`"
      body="El usuario no podrá iniciar sesión. Sus tickets y registros se conservan."
      confirm-label="Desactivar"
      danger
      @confirm="setActive(deactivating, false)"
      @cancel="deactivating = null"
    />
  </div>
</template>

<style scoped>
.users__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
}

.users__title {
  margin: 0;
  font-size: var(--font-size-24);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
}

.users__subtitle {
  margin: 6px 0 0;
  color: var(--color-text-muted);
}

.users__table {
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.users__row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.2fr) 120px 150px;
  gap: 16px;
  align-items: center;
  height: 52px;
  padding: 0 24px;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-13);
}

.users__row--head {
  height: auto;
  padding: 11px 24px;
  background: var(--color-surface-muted);
  border-bottom-color: var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
}

.users__row--inactive {
  color: var(--color-text-subtle);
}

.users__name {
  overflow: hidden;
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.users__username {
  font-family: var(--font-mono);
  font-size: var(--font-size-12-5);
}

.users__actions {
  text-align: right;
}

.users__self {
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.users__reactivate {
  color: var(--color-accent);
}

.users__hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.users__error {
  margin: 12px 0 0;
  color: var(--color-danger);
  font-size: var(--font-size-13);
}
</style>
