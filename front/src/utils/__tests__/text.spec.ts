import { describe, expect, it } from 'vitest'

import { formatLongDate } from '../format'
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
