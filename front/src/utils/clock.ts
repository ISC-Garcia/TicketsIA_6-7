// Mientras no haya back, el reloj se queda en la fecha de los datos simulados
// para que la antigüedad y el SLA de cada ticket no cambien entre sesiones.
const SIMULATED_NOW = '2026-10-28T11:42:10'

export const now = () => new Date(SIMULATED_NOW)

export const parseDateTime = (value: string) => new Date(value.replace(' ', 'T'))

export const minutesSince = (value: string) =>
  Math.floor((now().getTime() - parseDateTime(value).getTime()) / 60000)

export const toDateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
