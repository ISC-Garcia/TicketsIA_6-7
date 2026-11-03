<script setup lang="ts">
import { reactive, ref } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import FormField from '@/components/ui/FormField.vue'
import SidePanel from '@/components/ui/SidePanel.vue'
import { ROLE_MENUS } from '@/constants/roles'
import { ServiceError } from '@/services/http'
import { createUser } from '@/services/users'
import type { Role, User } from '@/types/user'

const USERNAME = /^[a-z0-9._]{3,}$/
const MIN_PASSWORD = 8
const ROLES = Object.keys(ROLE_MENUS) as Role[]

const props = defineProps<{
  existing: string[]
}>()

const emit = defineEmits<{ close: []; created: [user: User] }>()

const form = reactive({ name: '', username: '', role: 'tecnico' as Role, password: '' })
const errors = reactive<{ name?: string; username?: string; password?: string }>({})
const saving = ref(false)
const error = ref('')

// Mismas reglas y mensajes que el prototipo.
function validate() {
  errors.name = form.name.trim() ? undefined : 'Escribe el nombre completo.'
  errors.username = !USERNAME.test(form.username)
    ? 'Usa al menos 3 caracteres: minúsculas, números, punto o guion bajo.'
    : props.existing.includes(form.username)
      ? 'Ese usuario ya existe.'
      : undefined
  errors.password =
    form.password.length >= MIN_PASSWORD
      ? undefined
      : `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`
  return !errors.name && !errors.username && !errors.password
}

async function save() {
  error.value = ''
  if (!validate()) return

  saving.value = true
  try {
    emit('created', await createUser({ ...form, name: form.name.trim() }))
  } catch (cause) {
    if (!(cause instanceof ServiceError)) throw cause
    Object.assign(errors, cause.fields)
    if (!Object.keys(cause.fields).length) error.value = cause.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <SidePanel
    title="Nuevo usuario"
    subtitle="El usuario podrá iniciar sesión con el rol asignado."
    @close="emit('close')"
  >
    <form id="new-user" class="new-user" novalidate @submit.prevent="save">
      <FormField v-slot="{ id, invalid, describedBy }" label="Nombre completo" :error="errors.name">
        <BaseInput
          :id="id"
          v-model="form.name"
          autocomplete="off"
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>
      <FormField v-slot="{ id, invalid, describedBy }" label="Usuario" :error="errors.username">
        <BaseInput
          :id="id"
          v-model="form.username"
          class="new-user__mono"
          autocomplete="off"
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>
      <FormField v-slot="{ id }" label="Rol">
        <BaseSelect :id="id" v-model="form.role">
          <option v-for="role in ROLES" :key="role" :value="role">
            {{ ROLE_MENUS[role].label }}
          </option>
        </BaseSelect>
      </FormField>
      <FormField
        v-slot="{ id, invalid, describedBy }"
        label="Contraseña temporal"
        hint="Mínimo 8 caracteres. Se pedirá cambiarla en el primer acceso."
        :error="errors.password"
      >
        <BaseInput
          :id="id"
          v-model="form.password"
          type="password"
          autocomplete="new-password"
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>
      <p v-if="error" class="new-user__error" role="alert">{{ error }}</p>
    </form>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton type="submit" form="new-user" :disabled="saving">Crear usuario</BaseButton>
    </template>
  </SidePanel>
</template>

<style scoped>
.new-user {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.new-user__mono {
  font-family: var(--font-mono);
}

.new-user__error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-size-13);
}
</style>
