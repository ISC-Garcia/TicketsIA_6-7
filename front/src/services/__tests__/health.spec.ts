import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'

import { setMockFailure } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { now } from '@/utils/clock'

import { getHealth, syncClockWithServer } from '../health'

describe('health', () => {
  it('informa el estado de la API y su hora', async () => {
    expect(await getHealth()).toMatchObject({ status: 'ok', database: true, modelLoaded: true })
  })

  it('E11-02: toma la hora del servidor como referencia', async () => {
    server.use(
      http.get('*/api/health', () =>
        HttpResponse.json({
          status: 'ok',
          database: true,
          modelLoaded: true,
          now: '2026-11-03T09:26:11-06:00',
        }),
      ),
    )

    await syncClockWithServer()

    expect(now().toISOString()).toBe('2026-11-03T15:26:11.000Z')
  })

  it('E11-02: sin API se queda con el reloj del equipo', async () => {
    setMockFailure(true)

    await syncClockWithServer()

    expect(now().toISOString()).toBe(new Date('2026-10-28T11:42:10').toISOString())
  })
})
