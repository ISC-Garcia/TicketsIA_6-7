<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import FormField from '@/components/ui/FormField.vue'
import { ICONS } from '@/constants/icons'
import { ROLE_HOME } from '@/router/routes'
import { ServiceError } from '@/services/http'
import { useSessionStore } from '@/stores/session'

const DEMO_PASSWORD = 'demo2026'
const DEMO_ACCOUNTS = [
  { username: 'tecnico', label: 'Técnico de TI' },
  { username: 'coordinador', label: 'Coordinador' },
  { username: 'auditor', label: 'Auditor' },
]

const router = useRouter()
const session = useSessionStore()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const error = ref('')

const showDemoAccounts = import.meta.env.VITE_DEMO_MODE === 'true'
const passwordToggleLabel = computed(() => (showPassword.value ? 'Ocultar' : 'Mostrar'))

function fillDemoAccount(account: string) {
  username.value = account
  password.value = DEMO_PASSWORD
  error.value = ''
}

async function submit() {
  if (!username.value.trim() || !password.value) {
    error.value = 'Escribe tu usuario y contraseña.'
    return
  }

  submitting.value = true
  try {
    await session.signIn(username.value, password.value)
    error.value = ''
    await router.push({ name: ROLE_HOME[session.user!.role] })
  } catch (caught) {
    if (!(caught instanceof ServiceError)) throw caught
    error.value = caught.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login">
    <main class="login__card">
      <h1 class="login__title">Sistema de Tickets de Soporte Técnico</h1>
      <div class="login__institution">Instituto Tecnológico de Veracruz</div>
      <p class="login__description">
        Sistema inteligente que clasifica tickets de soporte con Machine Learning y analiza su texto
        con PNL.
      </p>

      <p v-if="session.notice" class="login__notice" role="status">{{ session.notice }}</p>

      <form class="login__form" novalidate @submit.prevent="submit">
        <FormField v-slot="{ id }" label="Usuario">
          <BaseInput
            :id="id"
            v-model="username"
            :invalid="Boolean(error)"
            autocomplete="username"
          />
        </FormField>

        <FormField v-slot="{ id, invalid, describedBy }" label="Contraseña" :error="error">
          <div class="login__password">
            <BaseInput
              :id="id"
              v-model="password"
              class="login__password-input"
              :type="showPassword ? 'text' : 'password'"
              :invalid="invalid"
              :aria-describedby="describedBy"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="login__password-toggle"
              :aria-label="`${passwordToggleLabel} contraseña`"
              @click="showPassword = !showPassword"
            >
              <BaseIcon :path="showPassword ? ICONS.eyeOff : ICONS.eye" :size="16" />
              {{ passwordToggleLabel }}
            </button>
          </div>
        </FormField>

        <BaseButton class="login__submit" type="submit" size="lg" block :disabled="submitting">
          Iniciar sesión
        </BaseButton>
      </form>

      <section v-if="showDemoAccounts" class="login__demo" aria-labelledby="demo-title">
        <h2 id="demo-title" class="login__demo-title">Accesos de demostración</h2>
        <div class="login__demo-list">
          <button
            v-for="account in DEMO_ACCOUNTS"
            :key="account.username"
            type="button"
            class="login__demo-row"
            :class="{ 'login__demo-row--active': username === account.username }"
            @click="fillDemoAccount(account.username)"
          >
            <span class="login__demo-label">{{ account.label }}</span>
            <span>
              usuario: <span class="login__demo-value">{{ account.username }}</span>
            </span>
            <span>
              contraseña: <span class="login__demo-value">{{ DEMO_PASSWORD }}</span>
            </span>
          </button>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 48px 24px;
}

.login__card {
  width: 420px;
  padding: 36px 36px 28px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.login__title {
  margin: 0;
  font-size: var(--font-size-21);
  font-weight: var(--font-weight-semibold);
  line-height: 1.3;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.login__institution {
  margin-top: 6px;
  color: var(--color-text-muted);
  font-size: var(--font-size-14);
}

.login__description {
  margin: 14px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
  line-height: 1.55;
  text-wrap: pretty;
}

.login__notice {
  margin: 24px 0 0;
  padding: 10px 14px;
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-6);
  background: var(--color-warning-tint);
  color: var(--color-warning);
  font-size: var(--font-size-13);
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 32px;
}

.login__password {
  position: relative;
}

.login__password .login__password-input {
  padding-right: 84px;
}

.login__password-toggle {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  background: transparent;
  border: none;
  border-radius: var(--radius-4);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--font-size-12);
}

.login__password-toggle:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.login__submit {
  margin-top: 2px;
}

.login__demo {
  margin-top: 28px;
  padding-top: 18px;
  border-top: 1px solid var(--color-border);
}

.login__demo-title {
  margin: 0 0 6px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
}

.login__demo-list {
  display: flex;
  flex-direction: column;
}

.login__demo-row {
  display: grid;
  grid-template-columns: 84px 1fr auto;
  align-items: center;
  gap: 8px;
  margin: 0 -8px;
  padding: 7px 8px;
  background: transparent;
  border: none;
  border-radius: var(--radius-4);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--font-size-12);
  text-align: left;
  white-space: nowrap;
}

.login__demo-row:hover,
.login__demo-row--active {
  background: var(--color-accent-soft);
}

.login__demo-label {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.login__demo-value {
  color: var(--color-text);
  font-family: var(--font-mono);
}
</style>
