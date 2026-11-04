<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import FormField from '@/components/ui/FormField.vue'
import { ROLE_HOME } from '@/router/routes'
import { ServiceError } from '@/services/http'
import { useSessionStore } from '@/stores/session'

const MIN_LENGTH = 8

const router = useRouter()
const session = useSessionStore()

const form = reactive({ current: '', next: '', confirm: '' })
const errors = reactive<{ current?: string; next?: string; confirm?: string }>({})
const saving = ref(false)
const error = ref('')

function validate() {
  errors.current = form.current ? undefined : 'Escribe tu contraseña temporal.'
  errors.next =
    form.next.length < MIN_LENGTH
      ? `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`
      : form.next === form.current
        ? 'Debe ser distinta de la actual.'
        : undefined
  errors.confirm = form.confirm === form.next ? undefined : 'Las contraseñas no coinciden.'
  return !errors.current && !errors.next && !errors.confirm
}

async function submit() {
  error.value = ''
  if (!validate()) return

  saving.value = true
  try {
    await session.updatePassword(form.current, form.next)
    await router.push({ name: ROLE_HOME[session.user!.role] })
  } catch (cause) {
    if (!(cause instanceof ServiceError)) throw cause
    errors.current = cause.fields.currentPassword
    errors.next = cause.fields.newPassword
    if (!Object.keys(cause.fields).length) error.value = cause.message
  } finally {
    saving.value = false
  }
}

async function signOut() {
  await session.signOut()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="password">
    <main class="password__card">
      <h1 class="password__title">Cambia tu contraseña</h1>
      <p class="password__description">
        Hola, {{ session.user?.name }}. Es tu primer acceso: elige una contraseña nueva para
        continuar. La temporal deja de funcionar al guardar.
      </p>

      <form class="password__form" novalidate @submit.prevent="submit">
        <FormField
          v-slot="{ id, invalid, describedBy }"
          label="Contraseña temporal"
          :error="errors.current"
        >
          <BaseInput
            :id="id"
            v-model="form.current"
            type="password"
            autocomplete="current-password"
            :invalid="invalid"
            :aria-describedby="describedBy"
          />
        </FormField>
        <FormField
          v-slot="{ id, invalid, describedBy }"
          label="Contraseña nueva"
          hint="Mínimo 8 caracteres."
          :error="errors.next"
        >
          <BaseInput
            :id="id"
            v-model="form.next"
            type="password"
            autocomplete="new-password"
            :invalid="invalid"
            :aria-describedby="describedBy"
          />
        </FormField>
        <FormField
          v-slot="{ id, invalid, describedBy }"
          label="Confirma la contraseña nueva"
          :error="errors.confirm"
        >
          <BaseInput
            :id="id"
            v-model="form.confirm"
            type="password"
            autocomplete="new-password"
            :invalid="invalid"
            :aria-describedby="describedBy"
          />
        </FormField>

        <p v-if="error" class="password__error" role="alert">{{ error }}</p>

        <BaseButton type="submit" size="lg" block :disabled="saving">
          {{ saving ? 'Guardando…' : 'Guardar y continuar' }}
        </BaseButton>
        <BaseButton variant="link" class="password__sign-out" @click="signOut">
          Cerrar sesión
        </BaseButton>
      </form>
    </main>
  </div>
</template>

<style scoped>
.password {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 48px 24px;
}

.password__card {
  width: 420px;
  padding: 36px 36px 28px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.password__title {
  margin: 0;
  font-size: var(--font-size-21);
  font-weight: var(--font-weight-semibold);
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.password__description {
  margin: 14px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
  line-height: 1.55;
  text-wrap: pretty;
}

.password__form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 28px;
}

.password__error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-size-13);
}

.password__sign-out {
  align-self: center;
}
</style>
