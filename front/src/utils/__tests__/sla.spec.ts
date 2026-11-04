import { describe, expect, it } from 'vitest'

import { slaOf } from '../sla'

describe('slaOf', () => {
  it.each([
    [0, 'normal'],
    [180, 'normal'],
    [181, 'risk'],
    [239, 'risk'],
    [240, 'overdue'],
    [300, 'overdue'],
  ])('abierto con %s minutos queda en %s', (ageMinutes, expected) => {
    expect(slaOf('Crítica', ageMinutes).state).toBe(expected)
  })

  it.each([
    [4, 'met'],
    [5, 'missed'],
  ])('resuelto en %s horas queda en %s', (hours, expected) => {
    expect(slaOf('Crítica', 300, hours).state).toBe(expected)
  })

  it('usa las horas de cada prioridad', () => {
    expect(slaOf('Baja', 5760).state).toBe('overdue')
  })
  it('calcula el porcentaje consumido', () => {
    expect(slaOf('Crítica', 120).percent).toBe(50)
  })
  it('limita el porcentaje a 100', () => {
    expect(slaOf('Crítica', 300).percent).toBe(100)
  })

  it('calcula el porcentaje de un ticket resuelto con sus horas', () => {
    expect(slaOf('Crítica', 300, 2).percent).toBe(50)
  })
})
