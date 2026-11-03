// La hora de referencia es la de la API: el front corrige la diferencia con el reloj del equipo
// al arrancar (ver main.ts). Así la antigüedad y el SLA coinciden con lo que calcula el servidor,
// y las pruebas E2E, que fijan la hora del servidor, ven los mismos datos siempre.
let offsetMs = 0

export const now = () => new Date(Date.now() + offsetMs)

export function syncClock(serverNow: string) {
  offsetMs = new Date(serverNow).getTime() - Date.now()
}

export const parseDateTime = (value: string) => new Date(value.replace(' ', 'T'))

export const minutesSince = (value: string, at: Date = now()) =>
  Math.floor((at.getTime() - parseDateTime(value).getTime()) / 60000)

export const toDateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

// "2026-10-28 11:42", el formato en que la API y las vistas muestran las fechas.
export const formatDateTime = (date: Date) =>
  `${toDateKey(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
