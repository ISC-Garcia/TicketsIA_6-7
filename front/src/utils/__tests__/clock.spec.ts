import { describe, expect, it } from 'vitest'

import { minutesSince, now, parseDateTime, toDateKey } from '../clock'

describe('now', () => {
  it('devuelve una fecha nueva en cada llamada', () => {
    const date = now()
    date.setDate(1)

    expect(now().getDate()).toBe(28)
  })
})

describe('parseDateTime', () => {
  it('interpreta el formato con espacio de los datos simulados', () => {
    expect(parseDateTime('2026-10-28 11:42:10').getTime()).toBe(now().getTime())
  })
})

describe('minutesSince', () => {
  it.each([
    ['2026-10-28 11:42:10', 0],
    ['2026-10-28 11:41:11', 0],
    ['2026-10-28 11:41:10', 1],
    ['2026-10-28 10:42:10', 60],
  ])('desde %s pasan %s minutos', (value, expected) => {
    expect(minutesSince(value)).toBe(expected)
  })
})

describe('toDateKey', () => {
  it('escribe la fecha simulada', () => {
    expect(toDateKey(now())).toBe('2026-10-28')
  })

  it('agrega el cero a mes y día', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
