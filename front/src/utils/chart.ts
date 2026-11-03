// Escalas de las gráficas del dashboard.

const STEPS = [1, 2, 2.5, 5, 10]

// El número "redondo" más pequeño que no es menor que `value`: 1, 2, 2.5 o 5 por potencia de 10.
export function niceStep(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return STEPS.map((step) => step * magnitude).find((step) => step >= value)!
}

// Tope del eje dividido en `parts` líneas iguales, con aire sobre el valor más alto.
export function niceMax(highest: number, parts: number, headroom = 1): number {
  return niceStep((highest * headroom) / parts) * parts
}

export const gridValues = (max: number, parts: number) =>
  Array.from({ length: parts + 1 }, (_, index) => (max / parts) * index)

export const formatNumber = (value: number) => value.toLocaleString('es-MX')

// Variación con signo, como en el prototipo: "+5", "−1.8 h", "+0.6 pts".
export function formatDelta(value: number, unit = '', decimals = 0): string {
  const rounded = Number(value.toFixed(decimals))
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  return `${sign}${Math.abs(rounded).toFixed(decimals)}${unit}`
}
