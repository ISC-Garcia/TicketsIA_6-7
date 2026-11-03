<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useRovingSelection } from '@/composables/useRovingSelection'
import { ServiceError } from '@/services/http'
import { assignTicket, listTechnicians } from '@/services/tickets'
import type { Technician, Ticket } from '@/types/ticket'

const props = defineProps<{
  ticket: Ticket
}>()

const emit = defineEmits<{ close: []; assigned: [ticket: Ticket] }>()

const technicians = ref<Technician[]>([])
const selected = ref(props.ticket.technicianUsername ?? '')
const loading = ref(true)
const saving = ref(false)
const error = ref('')

const unchanged = computed(() => selected.value === (props.ticket.technicianUsername ?? ''))
const loadLabel = (count: number) =>
  count === 1 ? '1 ticket abierto' : `${count} tickets abiertos`

const options = computed(() =>
  technicians.value.map((technician) => ({ key: technician.username })),
)
const { container, onKeydown } = useRovingSelection(
  () => options.value,
  () => selected.value,
  (key) => {
    selected.value = key
  },
)

// Solo una opción recibe foco con Tab: la elegida o, si no hay, la primera.
const tabIndexOf = (username: string, index: number) =>
  username === selected.value ||
  (!options.value.some((o) => o.key === selected.value) && index === 0)
    ? 0
    : -1

onMounted(async () => {
  try {
    technicians.value = await listTechnicians()
  } catch (cause) {
    if (!(cause instanceof ServiceError)) throw cause
    error.value = cause.message
  } finally {
    loading.value = false
  }
})

async function confirm() {
  saving.value = true
  error.value = ''
  try {
    emit('assigned', await assignTicket(props.ticket.id, selected.value))
  } catch (cause) {
    if (!(cause instanceof ServiceError)) throw cause
    error.value = cause.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    title="Reasignar técnico"
    :subtitle="`${ticket.id}, ${ticket.summary}`"
    @close="emit('close')"
  >
    <p v-if="loading" class="reassign__state">Cargando técnicos…</p>
    <div
      v-else
      ref="container"
      role="radiogroup"
      aria-label="Técnicos activos"
      class="reassign"
      @keydown="onKeydown"
    >
      <button
        v-for="(technician, index) in technicians"
        :key="technician.username"
        type="button"
        role="radio"
        class="reassign__option"
        :class="{ 'reassign__option--selected': technician.username === selected }"
        :aria-checked="technician.username === selected"
        :tabindex="tabIndexOf(technician.username, index)"
        @click="selected = technician.username"
      >
        <span class="reassign__radio" aria-hidden="true" />
        <span class="reassign__who">
          <span class="reassign__name">{{ technician.name }}</span>
          <span class="reassign__load">{{ loadLabel(technician.openTickets) }}</span>
        </span>
        <span v-if="technician.username === ticket.technicianUsername" class="reassign__current">
          Actual
        </span>
      </button>
    </div>
    <p v-if="error" class="reassign__error" role="alert">{{ error }}</p>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton :disabled="unchanged || loading || saving" @click="confirm">Reasignar</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.reassign {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reassign__state {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-13);
}

.reassign__option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-6);
  color: var(--color-text);
  font-size: var(--font-size-14);
  text-align: left;
  cursor: pointer;
}

.reassign__option--selected {
  background: var(--color-accent-soft);
  border-color: var(--color-accent-ring);
}

.reassign__radio {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid var(--color-border-strong);
  border-radius: 50%;
}

.reassign__option--selected .reassign__radio {
  border-color: var(--color-accent);
}

.reassign__option--selected .reassign__radio::after {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
}

.reassign__who {
  flex: 1;
  min-width: 0;
}

.reassign__name,
.reassign__load {
  display: block;
}

.reassign__load {
  margin-top: 1px;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
}

.reassign__current {
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-11);
}

.reassign__error {
  margin: 12px 0 0;
  color: var(--color-danger);
  font-size: var(--font-size-13);
}
</style>
