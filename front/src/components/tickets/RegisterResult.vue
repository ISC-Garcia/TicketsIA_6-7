<script setup lang="ts">
import { computed, ref } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import PriorityBadge from '@/components/ui/PriorityBadge.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import SidePanel from '@/components/ui/SidePanel.vue'
import type { DraftAnalysis, Priority, TicketDraft } from '@/types/ticket'
import { highlightText } from '@/utils/highlight'

const props = defineProps<{
  draft: TicketDraft
  result: DraftAnalysis
  registeredAt: string
  saving: boolean
  error: string
}>()

defineEmits<{ edit: []; confirm: [] }>()

const explaining = ref(false)

// De mayor a menor; la clase ganadora se distingue con el color fuerte.
const probabilities = computed(() =>
  (Object.entries(props.result.analysis.probabilities) as [Priority, number][]).sort(
    (a, b) => b[1] - a[1],
  ),
)
const segments = computed(() => highlightText(props.draft.description, props.result.highlights))
const deviceText = computed(() =>
  props.result.deviceDetected ? `${props.result.device} (detectado)` : props.result.device,
)
const errorCodes = computed(() => props.result.analysis.errorCodes.join(', ') || 'ninguno')
</script>

<template>
  <div class="result">
    <dl class="result__card result__capture">
      <div>
        <dt class="result__label">ID</dt>
        <dd class="result__value result__value--pending">Se asigna al confirmar</dd>
      </div>
      <div>
        <dt class="result__label">Fecha</dt>
        <dd class="result__value">{{ registeredAt }}</dd>
      </div>
      <div class="result__shrink">
        <dt class="result__label">Área solicitante</dt>
        <dd class="result__value">{{ draft.area }}</dd>
      </div>
      <div class="result__shrink">
        <dt class="result__label">Reporta</dt>
        <dd class="result__value result__value--ellipsis">{{ draft.reporter }}</dd>
      </div>
      <div class="result__shrink">
        <dt class="result__label">Dispositivo afectado</dt>
        <dd class="result__value">{{ deviceText }}</dd>
      </div>
      <BaseButton variant="link" :disabled="saving" @click="$emit('edit')">Editar</BaseButton>
    </dl>

    <section class="result__card" aria-labelledby="result-priority">
      <header class="result__priority">
        <span id="result-priority" class="result__muted">Prioridad asignada</span>
        <PriorityBadge :priority="result.priority" size="xl" />
        <span class="result__confidence">{{ result.analysis.confidence }} %</span>
        <span class="result__muted result__confidence-label">de confianza</span>
        <BaseButton variant="link" class="result__why" @click="explaining = true">
          ¿Por qué esta prioridad?
        </BaseButton>
      </header>

      <div class="result__body">
        <div class="result__column result__column--left">
          <h2 class="result__heading">Clasificación</h2>
          <div>
            <div class="result__label result__label--spaced">Probabilidad por clase</div>
            <div class="result__probabilities">
              <div
                v-for="([priority, value], index) in probabilities"
                :key="priority"
                class="result__probability"
              >
                <span>{{ priority }}</span>
                <ProgressBar
                  :value="value"
                  :height="8"
                  :color="index === 0 ? 'var(--color-accent)' : 'var(--color-accent-ring)'"
                  :label="`Probabilidad de ${priority}`"
                />
                <span class="result__percent">{{ value }} %</span>
              </div>
            </div>
          </div>
          <dl class="result__facts">
            <div>
              <dt class="result__label">Departamento sugerido</dt>
              <dd class="result__fact">{{ result.department }}</dd>
            </div>
            <div>
              <dt class="result__label">Sentimiento</dt>
              <dd class="result__fact">{{ result.analysis.sentiment }}</dd>
            </div>
          </dl>
        </div>

        <div class="result__column">
          <h2 class="result__heading">Análisis del texto</h2>
          <div>
            <p class="result__text">
              <template v-for="(segment, index) in segments" :key="index">
                <mark v-if="segment.highlighted" class="result__entity">{{ segment.text }}</mark>
                <template v-else>{{ segment.text }}</template>
              </template>
            </p>
            <div class="result__legend">
              <span class="result__legend-item">
                <span class="result__swatch" aria-hidden="true" />
                Entidad detectada
              </span>
              <span>Códigos de error: {{ errorCodes }}</span>
            </div>
          </div>
          <dl class="result__entities">
            <dt class="result__label">Intención</dt>
            <dd>
              <span class="result__intent">{{ result.analysis.intent }}</span>
            </dd>
            <dt class="result__label">Palabras clave</dt>
            <dd class="result__keywords">
              <span
                v-for="keyword in result.analysis.keywords"
                :key="keyword"
                class="result__keyword"
              >
                {{ keyword }}
              </span>
            </dd>
          </dl>
        </div>
      </div>

      <footer class="result__footer">
        <p v-if="error" class="result__error" role="alert">{{ error }}</p>
        <BaseButton variant="secondary" :disabled="saving" @click="$emit('edit')">
          Editar descripción
        </BaseButton>
        <BaseButton :disabled="saving" @click="$emit('confirm')">
          {{ saving ? 'Registrando…' : 'Confirmar registro' }}
        </BaseButton>
      </footer>
    </section>

    <SidePanel
      v-if="explaining"
      title="¿Por qué esta prioridad?"
      :subtitle="`Clasificada como ${result.priority}`"
      @close="explaining = false"
    >
      <div class="why">
        <p class="why__text">
          La clasificación combina el texto de la descripción con el área solicitante, el
          dispositivo afectado y el departamento y el sentimiento que se infieren del mismo texto.
          El modelo se entrenó con tickets históricos y asigna la clase con mayor probabilidad.
        </p>
        <dl class="why__rows">
          <div class="why__row">
            <dt>Descripción</dt>
            <dd>Términos con más peso: {{ result.analysis.keywords.join(', ') || 'ninguno' }}</dd>
          </div>
          <div class="why__row">
            <dt>Área solicitante</dt>
            <dd>{{ draft.area }}</dd>
          </div>
          <div class="why__row">
            <dt>Dispositivo afectado</dt>
            <dd>{{ deviceText }}</dd>
          </div>
          <div class="why__row">
            <dt>Departamento</dt>
            <dd>{{ result.department }} (inferido)</dd>
          </div>
          <div class="why__row">
            <dt>Sentimiento</dt>
            <dd>{{ result.analysis.sentiment }} (inferido)</dd>
          </div>
        </dl>
        <p class="why__note">
          La confianza de {{ result.analysis.confidence }} % es la probabilidad que el modelo asigna
          a la clase {{ result.priority }}. Si la descripción cambia, la prioridad se vuelve a
          calcular.
        </p>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="explaining = false">Cerrar</BaseButton>
      </template>
    </SidePanel>
  </div>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1120px;
}

.result__card {
  margin: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.result__capture {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr) auto;
  gap: 32px;
  align-items: center;
  padding: 16px 24px;
}

.result__shrink {
  min-width: 0;
}

.result__label {
  margin-bottom: 2px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.result__label--spaced {
  margin-bottom: 10px;
}

.result__value {
  margin: 0;
  font-size: var(--font-size-13);
  font-variant-numeric: tabular-nums;
}

.result__value--pending {
  color: var(--color-text-muted);
}

.result__value--ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result__priority {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px 28px;
  border-bottom: 1px solid var(--color-border-subtle);
}

.result__muted {
  color: var(--color-text-muted);
  font-size: var(--font-size-14);
}

.result__confidence {
  font-size: var(--font-size-18);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
}

.result__confidence-label {
  margin-left: -12px;
}

.result__why {
  margin-left: auto;
}

.result__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
}

.result__column {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 24px 28px;
}

.result__column--left {
  gap: 24px;
  border-right: 1px solid var(--color-border-subtle);
}

.result__heading {
  margin: 0;
  font-size: var(--font-size-13);
  font-weight: var(--font-weight-semibold);
}

.result__probabilities {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.result__probability {
  display: grid;
  grid-template-columns: 60px 1fr 40px;
  gap: 12px;
  align-items: center;
  font-size: var(--font-size-13);
}

.result__percent {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.result__facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 0;
  padding-top: 20px;
  border-top: 1px solid var(--color-border-subtle);
}

.result__facts .result__label {
  margin-bottom: 4px;
}

.result__fact {
  margin: 0;
  font-weight: var(--font-weight-medium);
}

.result__text {
  margin: 0;
  font-size: var(--font-size-15);
  line-height: 1.7;
  text-wrap: pretty;
}

.result__entity {
  padding: 1px 2px;
  background: var(--color-accent-soft);
  border-bottom: 1px solid var(--color-accent-ring);
  color: inherit;
}

.result__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 12px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.result__legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.result__swatch {
  width: 14px;
  height: 10px;
  background: var(--color-accent-soft);
  border-bottom: 1px solid var(--color-accent-ring);
}

.result__entities {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 12px 16px;
  align-items: center;
  margin: 0;
  padding-top: 20px;
  border-top: 1px solid var(--color-border-subtle);
}

.result__entities .result__label,
.result__entities dd {
  margin: 0;
}

.result__intent {
  padding: 3px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-4);
  font-size: var(--font-size-12);
}

.result__keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.result__keyword {
  padding: 3px 8px;
  background: var(--color-fill);
  border-radius: var(--radius-4);
  font-size: var(--font-size-12);
}

.result__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 28px;
  border-top: 1px solid var(--color-border-subtle);
}

.result__error {
  margin: 0 auto 0 0;
  color: var(--color-danger);
  font-size: var(--font-size-13);
}

.why {
  display: flex;
  flex-direction: column;
  gap: 20px;
  font-size: var(--font-size-14);
  line-height: 1.6;
}

.why__text,
.why__note {
  margin: 0;
}

.why__note {
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}

.why__rows {
  margin: 0;
  padding: 4px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}

.why__row {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-13);
}

.why__row:last-child {
  border-bottom: none;
}

.why__row dt {
  color: var(--color-text-muted);
}

.why__row dd {
  margin: 0;
}
</style>
