import type { Priority } from './ticket'

export const MODEL_TABS = ['metricas', 'matriz', 'datos', 'modelo'] as const
export type ModelTab = (typeof MODEL_TABS)[number]

// Porcentajes de 0 a 100, como los escribe el entrenamiento en `metricas.json`.
export interface ClassMetrics {
  priority: Priority
  precision: number
  recall: number
  f1: number
  support: number
}

export interface ModelMetrics {
  // Exactitud en pruebas con departamento y sentimiento predichos, como al registrar un ticket.
  accuracy: number
  validationAccuracy: number
  // Exactitud si el departamento y el sentimiento vinieran del dataset.
  accuracyWithDatasetContext: number
  // Exactitud de los clasificadores que predicen el contexto desde la descripción.
  context: { department: number; sentiment: number }
  classes: ClassMetrics[]
  confusionMatrix: { labels: Priority[]; matrix: number[][] }
  split: { train: number; validation: number; test: number }
  distribution: Record<Priority, number>
  parameters: {
    algorithm: string
    nEstimators: number
    classWeight: string
    tfidfMaxFeatures: number
    textFeature: string
    categoryFeatures: string[]
    target: string
    contextModel: string
    seed: number
  }
  trainedAt: string
  sklearnVersion: string
  cleaning: {
    rawRecords: number
    duplicates: number
    corruptDates: number
    missingDevices: number
    missingHours: number
    outlierHours: number
    cleanRecords: number
  }
  modelSha256: string
}
