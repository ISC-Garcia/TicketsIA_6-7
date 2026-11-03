import { describe, expect, it } from 'vitest'

import { formatLongDate, formatMinutes } from '../format'
import { initialsOf } from '../initials'

describe('initialsOf', () => {
  it.each([
    ['Roberto García Hernández', 'RG'],
    ['Francisco Alejandro Parra Huerta', 'FP'],
    ['Luis Daniel Morales Villarauz', 'LM'],
    ['Ana López', 'AL'],
    ['Ana', 'A'],
    ['  ana   lópez ', 'AL'],
  ])('%s da %s', (name, expected) => {
    expect(initialsOf(name)).toBe(expected)
  })
})

describe('formatLongDate', () => {
  it('escribe la fecha completa con mayúscula inicial', () => {
    expect(formatLongDate(new Date('2026-10-28T11:42:10'))).toBe('Miércoles, 28 de octubre de 2026')
  })
})

describe('formatMinutes', () => {
  it.each([
    [0, '0 min'],
    [59, '59 min'],
    [59.6, '1 h'],
    [60, '1 h'],
    [105, '1 h 45 min'],
    [599, '9 h 59 min'],
    [600, '10 h'],
    [630, '10 h'],
    [10079, '167 h'],
    [10080, '7 d'],
    [20000, '13 d'],
  ])('%s minutos dan %s', (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected)
  })
})
