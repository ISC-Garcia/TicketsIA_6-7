import type { ModelMetrics } from '@/types/model'

// El metricas.json de un entrenamiento completo, con los 102,000 registros del dataset.
export const modelMetrics: ModelMetrics = {
  accuracy: 94.64,
  validationAccuracy: 94.52,
  accuracyWithDatasetContext: 94.57,
  context: {
    department: 46.05,
    sentiment: 86.07,
  },
  classes: [
    {
      priority: 'Crítica',
      precision: 94.13,
      recall: 90.47,
      f1: 92.27,
      support: 2341,
    },
    {
      priority: 'Alta',
      precision: 93.95,
      recall: 93.37,
      f1: 93.66,
      support: 3046,
    },
    {
      priority: 'Media',
      precision: 95.02,
      recall: 96.08,
      f1: 95.55,
      support: 5102,
    },
    {
      priority: 'Baja',
      precision: 94.94,
      recall: 96.08,
      f1: 95.51,
      support: 4393,
    },
  ],
  confusionMatrix: {
    labels: ['Crítica', 'Alta', 'Media', 'Baja'],
    matrix: [
      [2118, 67, 89, 67],
      [45, 2844, 84, 73],
      [47, 68, 4902, 85],
      [40, 48, 84, 4221],
    ],
  },
  split: {
    train: 69446,
    validation: 14881,
    test: 14882,
  },
  distribution: {
    Crítica: 15611,
    Alta: 20302,
    Media: 34013,
    Baja: 29283,
  },
  parameters: {
    algorithm: 'Random Forest',
    nEstimators: 100,
    classWeight: 'balanced',
    tfidfMaxFeatures: 1000,
    textFeature: 'descripcion_problema',
    categoryFeatures: [
      'area_solicitante',
      'dispositivo_afectado',
      'departamento_asignado',
      'sentimiento',
    ],
    target: 'prioridad',
    contextModel: 'TF-IDF y regresión logística sobre la descripción',
    seed: 42,
  },
  trainedAt: '2026-11-03T12:53:12+00:00',
  sklearnVersion: '1.9.1',
  cleaning: {
    rawRecords: 102000,
    duplicates: 1786,
    corruptDates: 1017,
    missingDevices: 4078,
    missingHours: 4061,
    outlierHours: 514,
    cleanRecords: 99209,
  },
  modelSha256: '8a61fa6752a55c30bf9f38d5aced43fcc16c3074f974827cfb2809ba7571402f',
}
