import { describe, expect, it } from 'vitest'

import { minutesSince, now, parseDateTime, syncClock, toDateKey } from '../clock'

describe('now', () => {
  it('devuelve una fecha nueva en cada llamada', () => {
    const date = now()
    date.setDate(1)

    expect(now().getDate()).toBe(28)
  })

  it('E11-02: sigue la hora del servidor aunque el equipo tenga otra', () => {
    // El equipo dice 28 de octubre; el servidor, 3 de noviembre a las 09:26 en la Ciudad de México.
    syncClock('2026-11-03T09:26:11-06:00')

    expect(now().toISOString()).toBe('2026-11-03T15:26:11.000Z')
  })
})

describe('parseDateTime', () => {
  it('interpreta el formato con espacio de la API', () => {
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

  it('acepta otra hora de referencia', () => {
    expect(minutesSince('2026-10-28 10:42:10', parseDateTime('2026-10-28 12:42:10'))).toBe(120)
  })
})

describe('toDateKey', () => {
  it('escribe la fecha de hoy', () => {
    expect(toDateKey(now())).toBe('2026-10-28')
  })

  it('agrega el cero a mes y día', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
