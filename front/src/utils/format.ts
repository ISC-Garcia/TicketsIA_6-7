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
