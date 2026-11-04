import { describe, expect, it } from 'vitest'

import { formatDelta, formatNumber, gridValues, niceMax, niceStep } from '../chart'

describe('escalas de las gráficas', () => {
  it.each([
    [0, 1],
    [0.7, 1],
    [1.4, 2],
    [2.3, 2.5],
    [4.2, 5],
    [19.2, 20],
    [77.8, 100],
    [2400, 2500],
  ])('niceStep(%s) = %s', (value, step) => {
    expect(niceStep(value)).toBe(step)
  })

  it('deja aire sobre el valor más alto y divide en partes iguales', () => {
    // Como en el prototipo: 50 en tres partes da un eje de 0 a 60.
    expect(niceMax(50, 3, 1.15)).toBe(60)
    expect(niceMax(11, 3, 1.15)).toBe(15)
    expect(niceMax(96, 4)).toBe(100)
    expect(gridValues(60, 3)).toEqual([0, 20, 40, 60])
  })

  it.each([
    [5, '', 0, '+5'],
    [-1, '', 0, '−1'],
    [0, '', 0, '0'],
    [-1.84, ' h', 1, '−1.8 h'],
    [0.62, ' pts', 1, '+0.6 pts'],
    [0.04, ' pts', 1, '0.0 pts'],
  ])('formatDelta(%s) = %s', (value, unit, decimals, text) => {
    expect(formatDelta(value, unit, decimals)).toBe(text)
  })

  it('separa los miles', () => {
    expect(formatNumber(99008)).toBe('99,008')
  })
})
