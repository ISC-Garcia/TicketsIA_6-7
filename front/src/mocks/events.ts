import type { AuditEvent } from '@/types/event'

import { tickets } from './tickets'
import { FRANCISCO, LUIS, ROBERTO, SARELY } from './users'

const CREATED_BY: Record<string, string> = { 'TCK-200014': ROBERTO }

const ATTENDED_AT: Record<string, string> = {
  'TCK-200007': '2026-10-28 08:52:31',
  'TCK-200014': '2026-10-28 02:57:31',
}

const openTicketEvents: Omit<AuditEvent, 'id'>[] = tickets
  .filter((ticket) => ticket.status !== 'Resuelto')
  .flatMap((ticket) => {
    const user = CREATED_BY[ticket.id] ?? ticket.technician
    const attendedAt = ATTENDED_AT[ticket.id]
    const events: Omit<AuditEvent, 'id'>[] = [
      {
        time: `${ticket.createdAt}:04`,
        user,
        type: 'Ticket creado',
        ticketId: ticket.id,
        detail: `Reportado por ${ticket.reporter}, área ${ticket.area}`,
      },
      {
        time: `${ticket.createdAt}:05`,
        user: 'Sistema',
        type: 'Clasificado por IA',
        ticketId: ticket.id,
        detail: `Prioridad ${ticket.priority} (${ticket.analysis.confidence} %), ${ticket.department}`,
      },
    ]
    if (attendedAt) {
      events.push({
        time: attendedAt,
        user,
        type: 'Cambio de estado',
        ticketId: ticket.id,
        detail: 'Abierto a En atención',
      })
    }
    return events
  })

const otherEvents: Omit<AuditEvent, 'id'>[] = [
  {
    time: '2026-10-28 10:05:47',
    user: FRANCISCO,
    type: 'Reasignación',
    ticketId: 'TCK-200014',
    detail: `${ROBERTO} a ${SARELY}`,
  },
  {
    time: '2026-10-28 10:14:08',
    user: SARELY,
    type: 'Edición de datos',
    ticketId: 'TCK-200011',
    detail: 'dispositivo afectado Storage a Storage SAN',
    changes: [{ field: 'Dispositivo afectado', oldValue: 'Storage', newValue: 'Storage SAN' }],
  },
  { time: '2026-10-28 09:58:12', user: SARELY, type: 'Inicio de sesión' },
  { time: '2026-10-28 08:24:10', user: ROBERTO, type: 'Inicio de sesión' },
  { time: '2026-10-28 08:01:15', user: LUIS, type: 'Inicio de sesión' },
  { time: '2026-10-27 19:02:40', user: FRANCISCO, type: 'Cierre de sesión' },
  {
    time: '2026-10-27 18:40:22',
    user: FRANCISCO,
    type: 'Edición de datos',
    ticketId: 'TCK-115796',
    detail: 'tiempo de resolución 10.25 h a 2.00 h',
    changes: [{ field: 'Tiempo de resolución', oldValue: '10.25 h', newValue: '2.00 h' }],
    afterClose: true,
  },
  { time: '2026-10-27 18:31:09', user: FRANCISCO, type: 'Inicio de sesión' },
  { time: '2026-10-27 18:20:55', user: SARELY, type: 'Cierre de sesión' },
  {
    time: '2025-12-09 04:12:45',
    user: SARELY,
    type: 'Ticket resuelto',
    ticketId: 'TCK-115796',
    detail: '10.25 h',
    solution:
      'Se reemplazó el módulo de energía del switch y se restableció la configuración de puertos.',
  },
  {
    time: '2025-12-08 18:10:02',
    user: SARELY,
    type: 'Cambio de estado',
    ticketId: 'TCK-115796',
    detail: 'Abierto a En atención',
  },
  {
    time: '2025-12-08 17:57:46',
    user: 'Sistema',
    type: 'Clasificado por IA',
    ticketId: 'TCK-115796',
    detail: 'Prioridad Alta (81 %), Redes y Conectividad',
  },
  {
    time: '2025-12-08 17:57:45',
    user: SARELY,
    type: 'Ticket creado',
    ticketId: 'TCK-115796',
    detail: 'Reportado por Héctor Vázquez Luna, área Operaciones',
  },
]

export const events: AuditEvent[] = [...openTicketEvents, ...otherEvents].map((event, index) => ({
  ...event,
  id: `EV-${index}`,
}))
