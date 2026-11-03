<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import FormField from '@/components/ui/FormField.vue'
import SidePanel from '@/components/ui/SidePanel.vue'
import { ServiceError } from '@/services/http'
import { correctResolution, resolveTicket } from '@/services/tickets'
import type { Ticket } from '@/types/ticket'
import { minutesSince } from '@/utils/clock'

const MIN_SOLUTION = 10

const props = defineProps<{
  ticket: Ticket
  // Corrige un ticket ya resuelto en lugar de resolverlo (E4-07).
  correction?: boolean
}>()

const emit = defineEmits<{ close: []; resolved: [ticket: Ticket]; history: [] }>()

// Al resolver, las horas se precalculan desde el registro del ticket y se pueden ajustar (P-8).
// Al corregir, el formulario parte de lo que se registró.
const form = reactive({
  solution: props.correction ? (props.ticket.solution ?? '') : '',
  hours: props.correction
    ? (props.ticket.resolutionHours ?? 0).toFixed(2)
    : (minutesSince(props.ticket.createdAt) / 60).toFixed(2),
})
const errors = reactive<{ solution?: string; hours?: string }>({})
const stage = ref<'form' | 'saving' | 'done'>('form')
const confirming = ref(false)
const saveError = ref('')
const resolved = ref<Ticket | null>(null)

const COPY = {
  resolve: {
    title: 'Marcar como resuelto',
    done: 'Ticket resuelto',
    note: 'Al confirmar, el ticket se cerrará y el cambio quedará registrado en la bitácora del sistema.',
    confirmLabel: 'Confirmar resolución',
  },
  correct: {
    title: 'Corregir resolución',
    done: 'Resolución corregida',
    note: 'La corrección quedará registrada en la bitácora como una edición posterior al cierre.',
    confirmLabel: 'Guardar corrección',
  },
}
const copy = computed(() => COPY[props.correction ? 'correct' : 'resolve'])

const hoursNote = computed(() =>
  props.correction
    ? `Registrado: ${(props.ticket.resolutionHours ?? 0).toFixed(2)} h.`
    : `Calculado desde el registro del ticket (${props.ticket.createdAt.slice(11)}). Puedes ajustarlo.`,
)
const title = computed(() => (stage.value === 'done' ? copy.value.done : copy.value.title))
const confirmTitle = computed(() =>
  props.correction
    ? `¿Guardar la corrección de ${props.ticket.id}?`
    : `¿Confirmar la resolución de ${props.ticket.id}?`,
)

function validate() {
  const hours = Number(form.hours.replace(',', '.'))
  errors.solution =
    form.solution.trim().length >= MIN_SOLUTION
      ? undefined
      : `Describe la solución aplicada (mínimo ${MIN_SOLUTION} caracteres).`
  errors.hours = hours > 0 ? undefined : 'Escribe un tiempo válido en horas.'
  return !errors.solution && !errors.hours
}

function submit() {
  saveError.value = ''
  if (validate()) confirming.value = true
}

async function save() {
  confirming.value = false
  stage.value = 'saving'
  try {
    const resolution = {
      solution: form.solution.trim(),
      resolutionHours: Number(Number(form.hours.replace(',', '.')).toFixed(2)),
    }
    resolved.value = props.correction
      ? await correctResolution(props.ticket.id, resolution)
      : await resolveTicket(props.ticket.id, resolution)
    stage.value = 'done'
    emit('resolved', resolved.value)
  } catch (cause) {
    stage.value = 'form'
    if (!(cause instanceof ServiceError)) throw cause
    errors.solution = cause.fields.solution
    errors.hours = cause.fields.resolutionHours
    saveError.value = Object.keys(cause.fields).length ? '' : cause.message
  }
}
</script>

<template>
  <SidePanel :title="title" :subtitle="ticket.id" @close="emit('close')">
    <form
      v-if="stage === 'form'"
      id="resolve-form"
      class="resolve"
      novalidate
      @submit.prevent="submit"
    >
      <FormField
        v-slot="{ id, invalid, describedBy }"
        label="Solución aplicada"
        :error="errors.solution"
      >
        <BaseTextarea
          :id="id"
          v-model="form.solution"
          rows="6"
          placeholder="Describe qué se hizo para resolver el incidente"
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>

      <FormField
        v-slot="{ id, invalid, describedBy }"
        label="Tiempo de resolución"
        :hint="hoursNote"
        :error="errors.hours"
      >
        <div class="resolve__hours">
          <BaseInput
            :id="id"
            v-model="form.hours"
            inputmode="decimal"
            class="resolve__hours-input"
            :invalid="invalid"
            :aria-describedby="describedBy"
          />
          <span class="resolve__unit">horas</span>
        </div>
      </FormField>

      <p class="resolve__note">
        Al confirmar, el ticket se cerrará y el cambio quedará registrado en la bitácora del
        sistema.
      </p>
      <p v-if="saveError" class="resolve__error" role="alert">{{ saveError }}</p>
    </form>

    <div v-else-if="stage === 'saving'" class="resolve resolve__saving" role="status">
      <span class="resolve__saving-title">Guardando</span>
      <div class="resolve__saving-bar" aria-hidden="true" />
    </div>

    <div v-else-if="resolved" class="resolve">
      <p class="resolve__done">
        <template v-if="correction">
          Resolución de {{ resolved.id }} corregida: {{ resolved.resolutionHours?.toFixed(2) }} h
        </template>
        <template v-else>
          Ticket {{ resolved.id }} resuelto en {{ resolved.resolutionHours?.toFixed(2) }} h por
          {{ resolved.resolvedBy }}
        </template>
      </p>
      <div>
        <div class="resolve__label">Solución aplicada</div>
        <p class="resolve__solution">{{ resolved.solution }}</p>
      </div>
      <p class="resolve__muted">El cambio quedó registrado en la bitácora del sistema.</p>
    </div>

    <template #footer>
      <template v-if="stage === 'done'">
        <BaseButton variant="secondary" @click="emit('close')">Cerrar</BaseButton>
        <BaseButton @click="emit('history')">Ver historial del ticket</BaseButton>
      </template>
      <template v-else>
        <BaseButton variant="secondary" :disabled="stage === 'saving'" @click="emit('close')">
          Cancelar
        </BaseButton>
        <BaseButton type="submit" form="resolve-form" :disabled="stage === 'saving'">
          {{ copy.confirmLabel }}
        </BaseButton>
      </template>
    </template>
  </SidePanel>

  <ConfirmDialog
    v-if="confirming"
    :title="confirmTitle"
    :body="copy.note"
    :confirm-label="copy.confirmLabel"
    @confirm="save"
    @cancel="confirming = false"
  />
</template>

<style scoped>
.resolve {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.resolve__hours {
  display: flex;
  align-items: center;
  gap: 10px;
}

.resolve__hours-input {
  width: 120px;
  font-variant-numeric: tabular-nums;
}

.resolve__unit {
  color: var(--color-text-muted);
}

.resolve__note,
.resolve__done {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--color-accent-border);
  border-radius: var(--radius-6);
  background: var(--color-accent-soft);
  color: var(--color-accent-hover);
  font-size: var(--font-size-13);
  line-height: 1.5;
}

.resolve__done {
  padding: 16px 18px;
  border-radius: var(--radius-8);
  font-size: var(--font-size-15);
  font-weight: var(--font-weight-medium);
}

.resolve__error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-size-13);
}

.resolve__saving {
  gap: 14px;
  padding-top: 16px;
}

.resolve__saving-title {
  font-size: var(--font-size-16);
  font-weight: var(--font-weight-medium);
}

.resolve__saving-bar {
  height: 4px;
  border-radius: var(--radius-2);
  background: linear-gradient(90deg, var(--color-accent) 40%, var(--color-border-subtle) 40%);
  background-size: 200% 100%;
  animation: saving 1.2s linear infinite;
}

@keyframes saving {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}

.resolve__label {
  margin-bottom: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.resolve__solution {
  margin: 0;
  font-size: var(--font-size-14);
  line-height: 1.55;
}

.resolve__muted {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

@media (prefers-reduced-motion: reduce) {
  .resolve__saving-bar {
    animation: none;
  }
}
</style>
