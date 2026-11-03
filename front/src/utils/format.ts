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
