<script setup lang="ts">
import { ref } from 'vue'

import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTabs from '@/components/ui/BaseTabs.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormField from '@/components/ui/FormField.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import PriorityBadge from '@/components/ui/PriorityBadge.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { PRIORITIES, TICKET_STATUSES } from '@/types/ticket'

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'analisis', label: 'Análisis IA' },
  { key: 'historial', label: 'Historial' },
] as const
const PERIODS = [
  { key: 'semana', label: 'Última semana' },
  { key: 'mes', label: 'Último mes' },
  { key: 'año', label: 'Último año' },
] as const

const tab = ref<(typeof TABS)[number]['key']>('resumen')
const period = ref<(typeof PERIODS)[number]['key']>('mes')
const page = ref(1)
const name = ref('')
const area = ref('')
const description = ref('')
</script>

<template>
  <main class="kit">
    <h1 class="kit__title">Kit de componentes</h1>

    <BaseCard title="Botones" subtitle="Primario, secundario, peligro y enlace">
      <div class="kit__row">
        <BaseButton size="lg">Analizar y registrar</BaseButton>
        <BaseButton>Confirmar registro</BaseButton>
        <BaseButton variant="secondary">Cancelar</BaseButton>
        <BaseButton variant="danger">Desactivar</BaseButton>
        <BaseButton variant="secondary" size="sm">Anterior</BaseButton>
        <BaseButton variant="secondary" size="xs">Desactivar</BaseButton>
        <BaseButton variant="link">Limpiar filtros</BaseButton>
        <BaseButton disabled>Deshabilitado</BaseButton>
      </div>
    </BaseCard>

    <BaseCard title="Badges" subtitle="Prioridad, estado, rol y etiquetas">
      <div class="kit__row">
        <PriorityBadge v-for="item in PRIORITIES" :key="item" :priority="item" />
        <PriorityBadge priority="Crítica" size="md" />
        <PriorityBadge priority="Alta" size="lg" />
        <PriorityBadge priority="Media" size="xl" />
      </div>
      <div class="kit__row">
        <StatusBadge v-for="item in TICKET_STATUSES" :key="item" :status="item" />
        <StatusBadge status="Abierto" size="md" />
      </div>
      <div class="kit__row">
        <BaseBadge>Técnico de TI</BaseBadge>
        <BaseBadge tone="success">Activo</BaseBadge>
        <BaseBadge tone="muted">Inactivo</BaseBadge>
        <BaseBadge tone="warning">Edición posterior al cierre</BaseBadge>
        <BaseBadge tone="danger">Fallido</BaseBadge>
      </div>
    </BaseCard>

    <BaseCard title="Campos" subtitle="Con ayuda, error y variante compacta">
      <div class="kit__form">
        <FormField v-slot="{ id, invalid, describedBy }" label="Nombre de quien reporta">
          <BaseInput :id="id" v-model="name" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField
          v-slot="{ id, invalid, describedBy }"
          label="Área solicitante"
          error="Selecciona el área solicitante."
        >
          <BaseSelect :id="id" v-model="area" :invalid="invalid" :aria-describedby="describedBy">
            <option value="">Selecciona un área</option>
            <option>Ventas</option>
          </BaseSelect>
        </FormField>
        <FormField
          v-slot="{ id, invalid, describedBy }"
          label="Dispositivo afectado"
          hint="Si lo omites, el sistema intentará detectarlo en la descripción."
          optional
        >
          <BaseTextarea
            :id="id"
            v-model="description"
            rows="3"
            :invalid="invalid"
            :aria-describedby="describedBy"
          />
        </FormField>
      </div>
      <div class="kit__row">
        <BaseInput size="sm" placeholder="Buscar por ID o texto" class="kit__search" />
        <BaseSelect size="sm"><option value="">Estado: todos</option></BaseSelect>
      </div>
    </BaseCard>

    <BaseCard title="Pestañas y periodo" subtitle="Se usan con flechas, Inicio y Fin">
      <div class="kit__stack">
        <BaseTabs v-slot="{ active }" v-model="tab" :tabs="TABS" label="Secciones del ticket">
          Pestaña activa: {{ active }}
        </BaseTabs>
        <div class="kit__row">
          <SegmentedControl v-model="period" :options="PERIODS" label="Periodo" />
          <SegmentedControl v-model="period" :options="PERIODS" label="Periodo" size="sm" />
        </div>
      </div>
    </BaseCard>

    <BaseCard title="Progreso">
      <div class="kit__stack">
        <ProgressBar :value="62" label="Analizando descripción" />
        <ProgressBar
          :value="88"
          label="SLA consumido"
          :height="2"
          color="var(--color-priority-critical)"
        />
      </div>
    </BaseCard>

    <BaseCard padding="none">
      <PaginationBar v-model:page="page" :page-size="10" :total="37" />
    </BaseCard>

    <BaseCard padding="none">
      <EmptyState
        title="No hay tickets que coincidan con los filtros"
        action-label="Limpiar filtros"
      />
    </BaseCard>
  </main>
</template>

<style scoped>
.kit {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1040px;
  padding: 36px 40px 48px;
}

.kit__title {
  margin: 0;
  font-size: var(--font-size-24);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
}

.kit__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}

.kit__stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.kit__form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 480px;
  margin-top: 16px;
}

.kit__search {
  width: 260px;
}
</style>
