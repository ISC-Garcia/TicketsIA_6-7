import type { Priority } from '@/types/ticket'

export const SLA_HOURS: Record<Priority, number> = {
  Crítica: 4,
  Alta: 12,
  Media: 48,
  Baja: 96,
}

export type SlaState = 'normal' | 'risk' | 'overdue' | 'met' | 'missed'

export interface Sla {
  state: SlaState
  remainingMinutes: number
  percent: number
}

export function slaOf(priority: Priority, ageMinutes: number, resolutionHours?: number): Sla {
  const total = SLA_HOURS[priority] * 60
  const remainingMinutes = total - ageMinutes

  const usedMinutes = resolutionHours === undefined ? ageMinutes : resolutionHours * 60
  const percent = Math.min(Math.round((usedMinutes / total) * 100), 100)

  if (resolutionHours !== undefined) {
    if (usedMinutes <= total) {
      return { state: 'met', remainingMinutes, percent }
    } else {
      return { state: 'missed', remainingMinutes, percent }
    }
  }

  if (remainingMinutes <= 0) {
    return { state: 'overdue', remainingMinutes, percent }
  }

  if (remainingMinutes < total * 0.25) {
    return { state: 'risk', remainingMinutes, percent }
  }

  return { state: 'normal', remainingMinutes, percent }
}
