const longDate = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatLongDate(date: Date) {
  const text = longDate.format(date)

  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  const days = Math.floor(rounded / 1440)

  if (rounded < 60) return `${rounded} min`
  if (rounded < 600) {
    if (rest === 0) return `${hours} h`
    return `${hours} h ${rest} min`
  }
  if (rounded < 10080) return `${hours} h`
  return `${days} d`
}

export const formatTicketCount = (count: number) =>
  count === 1 ? '1 ticket' : `${count.toLocaleString('es-MX')} tickets`

// "12 d 4 h", "3 h 12 min", "8 min" o "40 s": cuánto lleva encendido el servidor.
export function formatUptime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days) return `${days} d ${hours % 24} h`
  if (hours) return `${hours} h ${minutes % 60} min`
  if (minutes) return `${minutes} min`
  return `${Math.floor(seconds)} s`
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

// "486 MB" o "1.2 GB", en múltiplos de 1,024 como los muestra PostgreSQL.
export function formatBytes(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  const decimals = value < 10 && unit > 0 ? 1 : 0
  return `${value.toLocaleString('es-MX', { maximumFractionDigits: decimals })} ${BYTE_UNITS[unit]}`
}
