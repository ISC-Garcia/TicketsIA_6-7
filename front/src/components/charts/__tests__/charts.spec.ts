import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import BarList from '../BarList.vue'
import LineChart from '../LineChart.vue'
import SlaColumns from '../SlaColumns.vue'
import TrendChart from '../TrendChart.vue'

describe('BarList', () => {
  it('escala cada barra contra la mayor y resume los datos para lectores de pantalla', () => {
    const wrapper = mount(BarList, {
      props: {
        label: 'Tickets por prioridad',
        items: [
          { label: 'Media', value: 34013, color: 'red', note: '34.3 %' },
          { label: 'Baja', value: 17006.5, color: 'blue' },
        ],
      },
    })

    const bars = wrapper.findAll('.bars__bar')
    expect(bars[0]!.attributes('style')).toContain('calc(1 * (100% - 120px))')
    expect(bars[1]!.attributes('style')).toContain('calc(0.5 * (100% - 120px))')
    expect(wrapper.find('.bars__value').text()).toBe('34,013 34.3 %')
    expect(wrapper.find('[role="img"]').attributes('aria-label')).toBe(
      'Tickets por prioridad: Media 34,013, Baja 17,006.5',
    )
  })
})

describe('TrendChart', () => {
  const mountTrend = (created: number[], resolved: number[]) =>
    mount(TrendChart, { props: { labels: ['S40', 'S41', 'S42'], created, resolved } })

  it('dibuja las dos líneas con su etiqueta final', () => {
    const wrapper = mountTrend([47, 43, 50], [44, 45, 10])

    expect(wrapper.findAll('polyline')).toHaveLength(2)
    expect(wrapper.find('.trend__end--created').text()).toBe('Creados 50')
    expect(wrapper.find('.trend__end--resolved').text()).toBe('Resueltos 10')
    expect(wrapper.findAll('.trend__axis').map((axis) => axis.text())).toEqual([
      '0',
      '20',
      '40',
      '60',
    ])
    expect(wrapper.find('[role="img"]').attributes('aria-label')).toContain(
      'S42: 50 creados y 10 resueltos',
    )
  })

  it.each([
    [[1, 2, 40], [1, 2, 41], 'creados arriba'],
    [[1, 2, 41], [1, 2, 40], 'resueltos arriba'],
  ])('separa las etiquetas finales cuando coinciden (%s)', (created, resolved) => {
    const wrapper = mountTrend(created, resolved)
    const top = (selector: string) =>
      parseFloat(wrapper.find(selector).attributes('style')!.split('top:')[1]!)

    expect(Math.abs(top('.trend__end--created') - top('.trend__end--resolved'))).toBeCloseTo(18)
  })

  it('con un solo punto lo centra', () => {
    const wrapper = mount(TrendChart, { props: { labels: ['Hoy'], created: [3], resolved: [1] } })

    expect(wrapper.find('.trend__label').attributes('style')).toContain('left: 50%')
  })
})

describe('SlaColumns', () => {
  it('marca en rojo la prioridad que pasa su SLA y avisa si no hay datos', () => {
    const wrapper = mount(SlaColumns, {
      props: {
        rows: [
          { priority: 'Crítica', averageHours: 4.9, slaHours: 4 },
          { priority: 'Alta', averageHours: 8.8, slaHours: 12 },
          { priority: 'Media', averageHours: null, slaHours: 48 },
          { priority: 'Baja', averageHours: 58.3, slaHours: 96 },
        ],
      },
    })

    const bars = wrapper.findAll('.sla__bar')
    expect(bars.map((bar) => bar.classes().includes('sla__bar--late'))).toEqual([
      true,
      false,
      false,
      false,
    ])
    expect(wrapper.findAll('.sla__value').map((value) => value.text())).toEqual([
      '4.9 h',
      '8.8 h',
      'Sin datos',
      '58.3 h',
    ])
    expect(wrapper.findAll('.sla__axis').map((axis) => axis.text())).toEqual([
      '0',
      '25',
      '50',
      '75',
      '100',
    ])
  })
})

describe('LineChart', () => {
  it('E9-03: corta la línea en los huecos y marca los puntos sueltos', () => {
    const wrapper = mount(LineChart, {
      props: {
        name: 'Conexiones activas',
        labels: ['A', 'B', 'C', 'D', 'E', 'F'],
        values: [2, 4, null, 3, null, 5],
      },
    })

    expect(wrapper.findAll('polyline')).toHaveLength(3)
    // C y E no tienen muestra: D y F quedan solos y se marcan con un punto.
    expect(wrapper.findAll('.line__dot')).toHaveLength(2)
    expect(wrapper.find('.line__end').text()).toBe('5')
    expect(wrapper.attributes('aria-label')).toBe('Conexiones activas. A: 2; B: 4; D: 3; F: 5')
  })

  it('con un solo tramo lo centra', () => {
    const wrapper = mount(LineChart, {
      props: { name: 'Consultas por hora', labels: ['09:00'], values: [120] },
    })

    expect(wrapper.find('.line__dot').attributes('style')).toContain('left: 50%')
    expect(wrapper.findAll('.line__label').map((label) => label.text())).toEqual(['09:00'])
  })

  it('muestra pocas etiquetas del eje en periodos largos', () => {
    const labels = Array.from({ length: 30 }, (_, index) => `Día ${index + 1}`)
    const wrapper = mount(LineChart, {
      props: { name: 'Consultas por hora', labels, values: labels.map(() => null) },
    })

    expect(wrapper.findAll('.line__label').map((label) => label.text())).toEqual([
      'Día 1',
      'Día 6',
      'Día 11',
      'Día 16',
      'Día 21',
      'Día 26',
      'Día 30',
    ])
    expect(wrapper.find('.line__end').exists()).toBe(false)
  })
})
