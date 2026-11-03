<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, useId } from 'vue'
import { useRouter } from 'vue-router'

import RegisterResult from '@/components/tickets/RegisterResult.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import FormField from '@/components/ui/FormField.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import { ServiceError } from '@/services/http'
import { analyzeTicket, createTicket } from '@/services/tickets'
import { useToastStore } from '@/stores/toast'
import { AREAS } from '@/types/ticket'
import type { Area, DraftAnalysis, TicketDraft } from '@/types/ticket'
import { useNow } from '@/composables/useNow'
import { formatDateTime } from '@/utils/clock'

const MAX_LENGTH = 1000
const MIN_LENGTH = 20
const STEPS = [
  'Normalizando y tokenizando el texto',
  'Extrayendo entidades y palabras clave',
  'Clasificando prioridad con el modelo',
]
// Ritmo de los pasos mientras responde la API. La API no informa su avance (H-12): los pasos
// solo marcan el tiempo y el último espera la respuesta real.
const STEP_MS = import.meta.env.MODE === 'test' ? 0 : 350
const EXAMPLE = {
  area: 'Contabilidad',
  reporter: 'Mariana López Ruiz',
  description:
    'El servidor principal se apagó y nadie tiene acceso a la base de datos de contabilidad. Urgente.',
} as const

type Field = 'area' | 'reporter' | 'description' | 'device'

const router = useRouter()
const toast = useToastStore()
const counterId = useId()

const form = reactive({ area: '' as Area | '', reporter: '', description: '', device: '' })
const errors = reactive<Partial<Record<Field, string>>>({})
const stage = ref<'form' | 'busy' | 'result'>('form')
const stepsDone = ref(0)
const formError = ref('')
const result = ref<DraftAnalysis | null>(null)
const saving = ref(false)
const saveError = ref('')
// Vista previa: la fecha definitiva la pone la API al confirmar.
const current = useNow()
const registeredAt = computed(() => formatDateTime(current.value))

const locked = computed(() => stage.value !== 'form')
const descriptionCount = computed(() => `${form.description.length} / ${MAX_LENGTH}`)
const canLoadExample = computed(() => !locked.value && !form.description)
const progress = computed(() => Math.round((stepsDone.value / STEPS.length) * 100))

function draft(): TicketDraft {
  return {
    area: form.area as Area,
    reporter: form.reporter.trim(),
    description: form.description.trim(),
    device: form.device.trim() || undefined,
  }
}

function validate() {
  errors.area = form.area ? undefined : 'Selecciona el área solicitante.'
  errors.reporter = form.reporter.trim() ? undefined : 'Escribe el nombre de quien reporta.'
  errors.description =
    form.description.trim().length >= MIN_LENGTH
      ? undefined
      : `Describe el problema con al menos ${MIN_LENGTH} caracteres.`
  return !errors.area && !errors.reporter && !errors.description
}

function loadExample() {
  Object.assign(form, EXAMPLE)
  Object.assign(errors, { area: undefined, reporter: undefined, description: undefined })
}

let stepTimer: ReturnType<typeof setTimeout> | undefined

function advanceSteps() {
  if (stepsDone.value >= STEPS.length - 1) return
  stepTimer = setTimeout(() => {
    stepsDone.value += 1
    advanceSteps()
  }, STEP_MS)
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function analyze() {
  formError.value = ''
  if (!validate()) return

  stage.value = 'busy'
  stepsDone.value = 0
  advanceSteps()
  try {
    const [analysis] = await Promise.all([analyzeTicket(draft()), wait(STEP_MS * STEPS.length)])
    clearTimeout(stepTimer)
    stepsDone.value = STEPS.length
    result.value = analysis
    stage.value = 'result'
  } catch (cause) {
    clearTimeout(stepTimer)
    stage.value = 'form'
    if (!(cause instanceof ServiceError)) throw cause
    Object.assign(errors, cause.fields)
    formError.value = Object.keys(cause.fields).length ? '' : cause.message
  }
}

function edit() {
  stage.value = 'form'
  saveError.value = ''
}

async function confirm() {
  saving.value = true
  saveError.value = ''
  try {
    const ticket = await createTicket(draft())
    toast.show('Ticket registrado', `${ticket.id}, asignado a ${ticket.technician}`)
    await router.push({ name: 'bandeja-detalle', params: { id: ticket.id } })
  } catch (cause) {
    if (!(cause instanceof ServiceError)) throw cause
    saveError.value = cause.message
  } finally {
    saving.value = false
  }
}

const stepState = (index: number) =>
  index < stepsDone.value ? 'done' : index === stepsDone.value ? 'active' : 'pending'

onBeforeUnmount(() => clearTimeout(stepTimer))
</script>

<template>
  <div class="register">
    <header class="register__header">
      <div>
        <h1 class="register__title">Registrar ticket</h1>
        <p class="register__subtitle">
          La prioridad, el departamento y el sentimiento se infieren a partir de la descripción.
        </p>
      </div>
      <ol class="register__steps" aria-label="Pasos del registro">
        <li
          class="register__step"
          :class="{
            'register__step--active': stage !== 'result',
            'register__step--done': stage === 'result',
          }"
          :aria-current="stage !== 'result' ? 'step' : undefined"
        >
          <span class="register__step-number">1</span>Captura
        </li>
        <li class="register__step-line" aria-hidden="true" />
        <li
          class="register__step"
          :class="{ 'register__step--active': stage === 'result' }"
          :aria-current="stage === 'result' ? 'step' : undefined"
        >
          <span class="register__step-number">2</span>Resultado del análisis
        </li>
      </ol>
    </header>

    <div v-if="stage !== 'result'" class="register__capture">
      <dl class="register__generated">
        <div>
          <dt class="register__label">ID</dt>
          <dd class="register__pending">Se asigna al confirmar</dd>
        </div>
        <div>
          <dt class="register__label">Fecha de registro</dt>
          <dd class="register__date">{{ registeredAt }}</dd>
        </div>
        <div class="register__auto">Generados automáticamente</div>
      </dl>

      <form class="register__form" novalidate @submit.prevent="analyze">
        <FormField
          v-slot="{ id, invalid, describedBy }"
          label="Área solicitante"
          :error="errors.area"
        >
          <BaseSelect
            :id="id"
            v-model="form.area"
            :invalid="invalid"
            :aria-describedby="describedBy"
            :disabled="locked"
          >
            <option value="">Selecciona un área</option>
            <option v-for="area in AREAS" :key="area">{{ area }}</option>
          </BaseSelect>
        </FormField>

        <FormField
          v-slot="{ id, invalid, describedBy }"
          label="Nombre de quien reporta"
          :error="errors.reporter"
        >
          <BaseInput
            :id="id"
            v-model="form.reporter"
            :invalid="invalid"
            :aria-describedby="describedBy"
            :disabled="locked"
            autocomplete="off"
          />
        </FormField>

        <FormField
          v-slot="{ id, invalid, describedBy }"
          label="Descripción del problema"
          :error="errors.description"
        >
          <BaseTextarea
            :id="id"
            v-model="form.description"
            rows="7"
            :maxlength="MAX_LENGTH"
            :invalid="invalid"
            :aria-describedby="[counterId, describedBy].filter(Boolean).join(' ')"
            :disabled="locked"
          />
          <div :id="counterId" class="register__counter">
            <span>Describe qué ocurre, a quién afecta y desde cuándo</span>
            <span class="register__count">{{ descriptionCount }}</span>
          </div>
        </FormField>

        <FormField
          v-slot="{ id, invalid, describedBy }"
          label="Dispositivo afectado"
          hint="Si lo omites, el sistema intentará detectarlo en la descripción."
          :error="errors.device"
          optional
        >
          <BaseInput
            :id="id"
            v-model="form.device"
            :invalid="invalid"
            :aria-describedby="describedBy"
            :disabled="locked"
          />
        </FormField>

        <p v-if="formError" class="register__error" role="alert">{{ formError }}</p>

        <div v-if="stage === 'form'" class="register__actions">
          <BaseButton type="submit">Analizar y registrar</BaseButton>
          <BaseButton v-if="canLoadExample" variant="link" @click="loadExample">
            Cargar descripción de ejemplo
          </BaseButton>
        </div>

        <div v-else class="register__busy" aria-live="polite">
          <div class="register__busy-title">
            <span>Analizando descripción</span>
            <span class="register__count">{{ progress }} %</span>
          </div>
          <ProgressBar :value="progress" label="Avance del análisis" />
          <ul class="register__busy-steps">
            <li
              v-for="(step, index) in STEPS"
              :key="step"
              class="register__busy-step"
              :class="`register__busy-step--${stepState(index)}`"
            >
              {{ stepState(index) === 'done' ? `Listo: ${step}` : step }}
            </li>
          </ul>
        </div>
      </form>
    </div>

    <RegisterResult
      v-else-if="result"
      :draft="draft()"
      :result="result"
      :registered-at="registeredAt"
      :saving="saving"
      :error="saveError"
      @edit="edit"
      @confirm="confirm"
    />
  </div>
</template>

<style scoped>
.register__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  margin-bottom: 28px;
}

.register__title {
  margin: 0;
  font-size: var(--font-size-24);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
}

.register__subtitle {
  margin: 6px 0 0;
  color: var(--color-text-muted);
}

.register__steps {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-13);
}

.register__step {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-muted);
}

.register__step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface);
  font-size: var(--font-size-12);
}

.register__step--active {
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.register__step--active .register__step-number {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.register__step--done {
  color: var(--color-text);
}

.register__step--done .register__step-number {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-text-inverse);
}

.register__step-line {
  width: 24px;
  height: 1px;
  background: var(--color-border);
}

.register__capture {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 640px;
}

.register__generated {
  display: flex;
  gap: 40px;
  margin: 0;
  padding: 0 2px;
}

.register__generated dd {
  margin: 0;
  font-size: var(--font-size-14);
}

.register__label {
  margin-bottom: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.register__pending {
  color: var(--color-text-muted);
}

.register__date {
  font-variant-numeric: tabular-nums;
}

.register__auto {
  align-self: flex-end;
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.register__form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 28px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.register__counter {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.register__count {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.register__error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-size-13);
}

.register__actions {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 4px;
}

.register__busy {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 4px;
}

.register__busy-title {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-14);
  font-weight: var(--font-weight-medium);
}

.register__busy-title .register__count {
  color: var(--color-text-muted);
  font-weight: var(--font-weight-regular);
}

.register__busy-steps {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.register__busy-step {
  font-size: var(--font-size-13);
}

.register__busy-step--done {
  color: var(--color-accent);
}

.register__busy-step--active {
  color: var(--color-text);
}

.register__busy-step--pending {
  color: var(--color-text-disabled);
}
</style>
