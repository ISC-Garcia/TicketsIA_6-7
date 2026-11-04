import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { createPinia, setActivePinia } from 'pinia'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { setMockFailure } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { useToastStore } from '@/stores/toast'

import RegisterView from '../RegisterView.vue'

const CRITICAL =
  'Caída total y pérdida de ping hacia el nodo principal del Cluster K8s con alerta DEADLOCK_DB.'

async function settle() {
  for (let round = 0; round < 4; round += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve))
  }
}

async function mountRegister() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/registrar', name: 'registrar', component: RegisterView },
      { path: '/bandeja/:id', name: 'bandeja-detalle', component: { render: () => h('div') } },
    ],
  })
  await router.push('/registrar')
  const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [router] } })
  return { wrapper, router }
}

type Wrapper = Awaited<ReturnType<typeof mountRegister>>['wrapper']

async function fill(wrapper: Wrapper, description = CRITICAL, device = '') {
  await wrapper.find('select').setValue('Operaciones')
  await wrapper.findAll('input')[0]!.setValue('Jorge Méndez Castillo')
  await wrapper.find('textarea').setValue(description)
  await wrapper.findAll('input')[1]!.setValue(device)
}

async function analyze(wrapper: Wrapper) {
  await wrapper.find('form').trigger('submit')
  await settle()
}

const button = (wrapper: Wrapper, label: string) =>
  wrapper.findAll('button').find((candidate) => candidate.text() === label)!

const alerts = (wrapper: Wrapper) => wrapper.findAll('[role="alert"]').map((alert) => alert.text())

describe('RegisterView', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('E3-04: pide área, nombre y 20 caracteres de descripción antes de analizar', async () => {
    const { wrapper } = await mountRegister()
    await wrapper.find('textarea').setValue('   corto   ')

    await analyze(wrapper)

    expect(alerts(wrapper)).toEqual([
      'Selecciona el área solicitante.',
      'Escribe el nombre de quien reporta.',
      'Describe el problema con al menos 20 caracteres.',
    ])
    expect(wrapper.find('.result').exists()).toBe(false)
  })

  it('E3-04: muestra la fecha, el contador y el ID pendiente', async () => {
    const { wrapper } = await mountRegister()

    await wrapper.find('textarea').setValue('Hola mundo')

    expect(wrapper.find('.register__generated').text()).toContain('Se asigna al confirmar')
    expect(wrapper.find('.register__generated').text()).toContain('2026-10-28 11:42')
    expect(wrapper.find('textarea').attributes('maxlength')).toBe('1000')
    expect(wrapper.find('.register__counter').text()).toContain('10 / 1000')
  })

  it('E3-04: carga la descripción de ejemplo y oculta el botón', async () => {
    const { wrapper } = await mountRegister()

    await button(wrapper, 'Cargar descripción de ejemplo').trigger('click')

    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('Contabilidad')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toContain(
      'servidor principal',
    )
    expect(button(wrapper, 'Cargar descripción de ejemplo')).toBeUndefined()
  })

  it('E3-04: bloquea el formulario mientras analiza y marca los tres pasos', async () => {
    const { wrapper } = await mountRegister()
    await fill(wrapper)

    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.register__busy').text()).toContain('Analizando descripción')
    expect(wrapper.findAll('.register__busy-step')).toHaveLength(3)
    await settle()
    expect(wrapper.find('.result').exists()).toBe(true)
  })

  it('E3-04: muestra en su campo los errores de validación de la API', async () => {
    server.use(
      http.post('*/api/tickets/analyze', () =>
        HttpResponse.json(
          {
            detail: 'Revisa los datos enviados.',
            errors: [{ field: 'device', message: 'Debe tener como máximo 80 caracteres.' }],
          },
          { status: 422 },
        ),
      ),
    )
    const { wrapper } = await mountRegister()
    await fill(wrapper)

    await analyze(wrapper)

    expect(alerts(wrapper)).toEqual(['Debe tener como máximo 80 caracteres.'])
    expect(wrapper.find('textarea').attributes('disabled')).toBeUndefined()
  })

  it('E3-04: sin modelo o sin conexión avisa y vuelve a la captura', async () => {
    server.use(
      http.post('*/api/tickets/analyze', () =>
        HttpResponse.json(
          { detail: 'El modelo de clasificación no está disponible. Avisa al administrador.' },
          { status: 503 },
        ),
      ),
    )
    const { wrapper } = await mountRegister()
    await fill(wrapper)

    await analyze(wrapper)
    expect(alerts(wrapper)).toEqual([
      'El modelo de clasificación no está disponible. Avisa al administrador.',
    ])

    server.resetHandlers()
    setMockFailure(true)
    await analyze(wrapper)
    expect(alerts(wrapper)).toEqual(['No se pudo conectar con el servidor.'])
  })

  it('E3-05: muestra la prioridad, las probabilidades y el texto resaltado', async () => {
    const { wrapper } = await mountRegister()
    await fill(wrapper)

    await analyze(wrapper)

    const result = wrapper.find('.result')
    expect(result.find('.priority').text()).toBe('Crítica')
    expect(result.find('.result__confidence').text()).toBe('88 %')
    expect(result.findAll('.result__probability span:first-child').map((s) => s.text())).toEqual([
      'Crítica',
      'Alta',
      'Media',
      'Baja',
    ])
    expect(result.findAll('mark').map((mark) => mark.text())).toEqual([
      'Cluster K8s',
      'DEADLOCK_DB',
    ])
    expect(result.text()).toContain('Cluster K8s (detectado)')
    expect(result.text()).toContain('Códigos de error: DEADLOCK_DB')
    expect(wrapper.findAll('.register__step')[1]!.attributes('aria-current')).toBe('step')
  })

  it('E3-05: el dispositivo escrito no se marca como detectado', async () => {
    const { wrapper } = await mountRegister()
    await fill(wrapper, 'La impresora del área no imprime desde ayer en la mañana.', 'Impresora 3')

    await analyze(wrapper)

    expect(wrapper.find('.result').text()).toContain('Impresora 3')
    expect(wrapper.find('.result').text()).not.toContain('(detectado)')
    expect(wrapper.find('.result').text()).toContain('Códigos de error: ninguno')
  })

  it('E3-05: explica la prioridad con las cinco variables del modelo', async () => {
    const { wrapper } = await mountRegister()
    await fill(wrapper)
    await analyze(wrapper)

    await button(wrapper, '¿Por qué esta prioridad?').trigger('click')

    const panel = wrapper.find('dialog')
    expect(panel.findAll('.why__row dt').map((term) => term.text())).toEqual([
      'Descripción',
      'Área solicitante',
      'Dispositivo afectado',
      'Departamento',
      'Sentimiento',
    ])
    expect(panel.text()).toContain('La confianza de 88 %')

    await panel
      .findAll('button')
      .find((candidate) => candidate.text() === 'Cerrar')!
      .trigger('click')
    expect(wrapper.find('dialog').exists()).toBe(false)
  })

  it('E3-05: editar vuelve a la captura con los datos', async () => {
    const { wrapper } = await mountRegister()
    await fill(wrapper)
    await analyze(wrapper)

    await button(wrapper, 'Editar descripción').trigger('click')

    expect(wrapper.find('.result').exists()).toBe(false)
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe(CRITICAL)
    expect(button(wrapper, 'Analizar y registrar')).toBeDefined()
  })

  it('E3-05: confirmar registra el ticket, avisa y abre su detalle', async () => {
    const { wrapper, router } = await mountRegister()
    await fill(wrapper)
    await analyze(wrapper)

    await button(wrapper, 'Confirmar registro').trigger('click')
    await settle()

    expect(router.currentRoute.value.fullPath).toBe('/bandeja/TCK-200030')
    expect(useToastStore().current).toMatchObject({
      message: 'Ticket registrado',
      detail: 'TCK-200030, asignado a Roberto García Hernández',
    })
  })

  it('E3-05: si falla el registro lo avisa y conserva el resultado', async () => {
    const { wrapper } = await mountRegister()
    await fill(wrapper)
    await analyze(wrapper)
    setMockFailure(true)

    await button(wrapper, 'Confirmar registro').trigger('click')
    await settle()

    expect(wrapper.find('.result__error').text()).toBe('No se pudo conectar con el servidor.')
    expect(wrapper.find('.result').exists()).toBe(true)
  })
})
