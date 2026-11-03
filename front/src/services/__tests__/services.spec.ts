import { afterEach, describe, expect, it } from 'vitest'

import { listBackups, listTables } from '../database'
import { listEvents, listTicketEvents } from '../events'
import { mockRequest, paginate, ServiceError, setMockFailure } from '../mockRequest'
import { countTicketsByPriority, getTicket, listTickets } from '../tickets'
import { listUsers } from '../users'
import { minutesSince } from '@/utils/clock'

afterEach(() => setMockFailure(false))

describe('mockRequest', () => {
  it('devuelve copias para que nadie modifique los datos simulados', async () => {
    const first = await getTicket('TCK-200003')
    first!.summary = 'Modificado'

    expect((await getTicket('TCK-200003'))?.summary).not.toBe('Modificado')
  })

  it('falla a pedido con un error de servicio', async () => {
    setMockFailure(true)

    await expect(listTickets()).rejects.toBeInstanceOf(ServiceError)
  })

  it('convierte en rechazo un error interno', async () => {
    const failing = mockRequest(() => {
      throw new Error('falló')
    })

    await expect(failing).rejects.toThrow('falló')
  })
})

describe('paginate', () => {
  it('corta la página pedida y conserva el total', () => {
    expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual({ items: [3, 4], total: 5 })
    expect(paginate([1, 2, 3], 2, 2)).toEqual({ items: [3], total: 3 })
  })

  it('sin parámetros devuelve todo', () => {
    expect(paginate([1, 2, 3])).toEqual({ items: [1, 2, 3], total: 3 })
  })
})

describe('listTickets', () => {
  const ids = async (query = {}) => (await listTickets(query)).items.map((ticket) => ticket.id)

  it('ordena por prioridad y luego por antigüedad, sin resueltos', async () => {
    expect(await ids()).toEqual([
      'TCK-200007',
      'TCK-200003',
      'TCK-200014',
      'TCK-200011',
      'TCK-200021',
      'TCK-200018',
      'TCK-200029',
      'TCK-200025',
    ])
  })

  it('muestra resueltos solo al filtrar por ese estado', async () => {
    expect(await ids({ status: 'Resuelto' })).toEqual(['TCK-115796'])
  })

  it.each([
    [{ priority: 'Crítica' }, 2],
    [{ department: 'Seguridad Informática' }, 2],
    [{ status: 'En atención' }, 2],
    [{ status: 'Abierto' }, 6],
    [{ date: 'hoy' }, 4],
    [{ date: '48' }, 7],
    [{ date: '7' }, 8],
    [{ search: 'dead' }, 1],
    [{ search: ' contabilidad ' }, 3],
  ])('filtra con %o', async (query, expected) => {
    expect((await listTickets(query as object)).total).toBe(expected)
  })

  it('el filtro de 7 días excluye tickets antiguos', async () => {
    expect((await listTickets({ status: 'Resuelto', date: '7' })).total).toBe(0)
  })

  it('combina filtros y pagina', async () => {
    const page = await listTickets({ priority: 'Baja', page: 2, pageSize: 1 })

    expect(page.total).toBe(2)
    expect(page.items.map((ticket) => ticket.id)).toEqual(['TCK-200025'])
  })

  it('reproduce la antigüedad del prototipo desde la fecha de registro', async () => {
    const { items } = await listTickets()
    const ages = Object.fromEntries(
      items.map((ticket) => [ticket.id, minutesSince(ticket.createdAt)]),
    )

    expect(ages).toEqual({
      'TCK-200003': 105,
      'TCK-200007': 190,
      'TCK-200011': 320,
      'TCK-200014': 545,
      'TCK-200018': 840,
      'TCK-200021': 1560,
      'TCK-200025': 1800,
      'TCK-200029': 3120,
    })
  })
})

describe('countTicketsByPriority', () => {
  it('cuenta los tickets activos por prioridad', async () => {
    expect(await countTicketsByPriority()).toEqual({ Crítica: 2, Alta: 2, Media: 2, Baja: 2 })
  })

  it('cuenta los resueltos por separado', async () => {
    expect(await countTicketsByPriority(true)).toEqual({ Crítica: 0, Alta: 1, Media: 0, Baja: 0 })
  })
})

describe('getTicket', () => {
  it('devuelve null si el ticket no existe', async () => {
    expect(await getTicket('TCK-000000')).toBeNull()
  })
})

describe('listEvents', () => {
  it('ordena del más reciente al más antiguo y pagina de 10 en 10', async () => {
    const { items, total } = await listEvents()

    expect(total).toBe(31)
    expect(items).toHaveLength(10)
    expect(items[0]?.time).toBe('2026-10-28 10:14:08')
  })

  it.each([
    [{ type: 'Reasignación' }, 1],
    [{ user: 'Sistema' }, 9],
    [{ date: 'hoy' }, 15],
    [{ date: '7' }, 27],
    [{ ticketId: ' tck-115796 ' }, 5],
    [{ afterClose: true }, 1],
  ])('filtra con %o', async (query, expected) => {
    expect((await listEvents(query as object)).total).toBe(expected)
  })
})

describe('listTicketEvents', () => {
  it('devuelve la línea de tiempo en orden cronológico', async () => {
    const timeline = await listTicketEvents('TCK-115796')

    expect(timeline.map((event) => event.type)).toEqual([
      'Ticket creado',
      'Clasificado por IA',
      'Cambio de estado',
      'Ticket resuelto',
      'Edición de datos',
    ])
  })
})

describe('datos de referencia', () => {
  it('incluye a los 4 usuarios sin nombres duplicados del coordinador', async () => {
    const users = await listUsers()

    expect(users).toHaveLength(4)
    expect(users.find((user) => user.role === 'coordinador')?.name).toBe(
      'Francisco Alejandro Parra Huerta',
    )
  })

  it('las tablas suman los 486 MB del prototipo', async () => {
    const tables = await listTables()
    const total = tables.reduce((sum, table) => sum + parseFloat(table.size), 0)

    expect(total).toBeCloseTo(486)
  })

  it('el respaldo fallido tiene su reintento', async () => {
    const backups = await listBackups()

    expect(backups.filter((backup) => backup.status === 'Fallido')).toHaveLength(1)
    expect(backups.filter((backup) => backup.isRetry)).toHaveLength(1)
  })
})
