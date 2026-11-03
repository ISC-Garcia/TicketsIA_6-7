import { describe, expect, it } from 'vitest'

import {
  formatBytes,
  formatLongDate,
  formatMinutes,
  formatTicketCount,
  formatUptime,
} from '../format'
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

describe('formatTicketCount', () => {
  it.each([
    [0, '0 tickets'],
    [1, '1 ticket'],
    [8, '8 tickets'],
  ])('%s da %s', (count, expected) => {
    expect(formatTicketCount(count)).toBe(expected)
  })
})

describe('formatUptime', () => {
  it.each([
    [40, '40 s'],
    [8 * 60 + 5, '8 min'],
    [3 * 3600 + 12 * 60, '3 h 12 min'],
    [12 * 86400 + 4 * 3600 + 59 * 60, '12 d 4 h'],
  ])('%s s se leen como %s', (seconds, expected) => {
    expect(formatUptime(seconds)).toBe(expected)
  })
})

describe('formatBytes', () => {
  it.each([
    [512, '512 B'],
    [1536, '1.5 KB'],
    [115_152_563, '110 MB'],
    [1.25 * 1024 ** 3, '1.3 GB'],
    [3 * 1024 ** 5, '3,072 TB'],
  ])('%s bytes se leen como %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })
})
