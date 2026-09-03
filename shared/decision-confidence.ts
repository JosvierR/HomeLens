import { z } from 'zod'

export const MAX_MEASUREMENT_VALUE_FEET = 100
export const REQUIRED_MEASUREMENT_IDS = ['width', 'length', 'height'] as const

const confidenceSchema = z.number().finite().min(0).max(1)
const dimensionValueSchema = z.number().finite().positive().max(MAX_MEASUREMENT_VALUE_FEET)

export const originalEstimateSchema = z.object({
  value: dimensionValueSchema,
  confidence: confidenceSchema,
  capturedAt: z.string().datetime({ offset: true }).optional()
}).strict()

export const verificationMetadataSchema = z.object({
  verifiedAt: z.string().datetime({ offset: true }),
  verificationSource: z.literal('manual'),
  previousValue: dimensionValueSchema,
  previousConfidence: confidenceSchema
}).strict()

export const measurementSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  value: dimensionValueSchema,
  unit: z.literal('ft'),
  confidence: confidenceSchema,
  source: z.enum(['estimated', 'manual']),
  rawConfidence: confidenceSchema.optional(),
  calibratedConfidence: confidenceSchema.optional(),
  originalEstimate: originalEstimateSchema.optional(),
  verification: verificationMetadataSchema.optional()
}).strict().superRefine((measurement, context) => {
  if (measurement.source === 'manual' && measurement.confidence !== 1) {
    context.addIssue({
      code: 'custom',
      path: ['confidence'],
      message: 'Manually verified measurements must have confidence 1.'
    })
  }
})

export const roomScanSchema = z.object({
  id: z.string().trim().min(1).max(120),
  roomId: z.string().trim().min(1).max(120).optional(),
  roomName: z.string().trim().min(1).max(120),
  createdAt: z.string().datetime({ offset: true }),
  measurements: z.array(measurementSchema).min(3).max(100),
  windows: z.number().int().min(0).max(100),
  doors: z.number().int().min(0).max(100),
  modelVersion: z.string().trim().min(1).max(80).optional(),
  captureMethod: z.string().trim().min(1).max(80).optional(),
  deviceFamily: z.string().trim().min(1).max(80).optional(),
  roomCategory: z.string().trim().min(1).max(80).optional()
}).strict().superRefine((scan, context) => {
  const ids = new Set<string>()
  scan.measurements.forEach((measurement, index) => {
    if (ids.has(measurement.id)) {
      context.addIssue({
        code: 'custom',
        path: ['measurements', index, 'id'],
        message: `Duplicate measurement id: ${measurement.id}`
      })
    }
    ids.add(measurement.id)
  })

  REQUIRED_MEASUREMENT_IDS.forEach(requiredId => {
    if (!ids.has(requiredId)) {
      context.addIssue({
        code: 'custom',
        path: ['measurements'],
        message: `Missing required measurement: ${requiredId}`
      })
    }
  })
})

export type DecisionMeasurement = z.infer<typeof measurementSchema>
export type DecisionRoomScan = z.infer<typeof roomScanSchema>
export type RecommendationBand = 'compact' | 'standard' | 'high-capacity'

export interface DecisionConfidenceOptions {
  confidenceOverrides?: Readonly<Record<string, number>>
}

export interface VerificationPriority {
  measurementId: string
  label: string
  /** Effective confidence used for this analysis. */
  confidence: number
  rawConfidence: number
  calibratedConfidence?: number
  calibrationApplied: boolean
  impactPercent: number
  priorityScore: number
  reason: string
}

export interface DecisionConfidenceResult {
  baselineIndex: number
  expectedBand: RecommendationBand
  /** Public stability contract: a fraction in the inclusive range 0..1. */
  bandStability: number
  stabilityLabel: 'stable' | 'watch' | 'unstable'
  likelyRange: { low: number, high: number }
  bandDistribution: Record<RecommendationBand, number>
  verificationQueue: VerificationPriority[]
  scenarioCount: number
  summary: string
}

const getMeasurement = (scan: DecisionRoomScan, id: string) => {
  const measurement = scan.measurements.find(item => item.id === id)
  if (!measurement) throw new Error(`Missing required measurement: ${id}`)
  return measurement
}

const planningIndex = (scan: DecisionRoomScan, overrides: Readonly<Record<string, number>> = {}) => {
  const width = overrides.width ?? getMeasurement(scan, 'width').value
  const length = overrides.length ?? getMeasurement(scan, 'length').value
  const height = overrides.height ?? getMeasurement(scan, 'height').value
  const area = width * length
  const volumeFactor = Math.max(0.75, height / 8)
  return area * volumeFactor + scan.windows * 12 + scan.doors * 8
}

const bandFor = (value: number): RecommendationBand => {
  if (value < 320) return 'compact'
  if (value < 420) return 'standard'
  return 'high-capacity'
}

const uncertaintyFraction = (confidence: number) => (1 - confidence) * 0.29

const deterministicNoise = (sample: number, salt: number) => {
  const x = Math.sin((sample + 1) * (12.9898 + salt * 17.17)) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

const effectiveConfidence = (
  measurement: DecisionMeasurement,
  overrides: Readonly<Record<string, number>>
) => {
  const confidence = overrides[measurement.id] ?? measurement.confidence
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`Confidence override for ${measurement.id} must be between 0 and 1.`)
  }
  return confidence
}

export const calculateDecisionConfidence = (
  input: DecisionRoomScan,
  sampleCount = 600,
  options: DecisionConfidenceOptions = {}
): DecisionConfidenceResult => {
  const scan = roomScanSchema.parse(input)
  if (!Number.isInteger(sampleCount) || sampleCount < 1) {
    throw new Error('Sample count must be a positive integer.')
  }

  const confidenceOverrides = options.confidenceOverrides ?? {}
  const baselineIndex = planningIndex(scan)
  const expectedBand = bandFor(baselineIndex)
  const samples: number[] = []
  const counts: Record<RecommendationBand, number> = { compact: 0, standard: 0, 'high-capacity': 0 }

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const overrides: Record<string, number> = {}
    scan.measurements.forEach((measurement, index) => {
      const confidence = measurement.source === 'manual' ? 1 : effectiveConfidence(measurement, confidenceOverrides)
      const spread = uncertaintyFraction(confidence)
      const noise = deterministicNoise(sample, index + 1)
      overrides[measurement.id] = measurement.value * (1 + noise * spread)
    })
    const indexValue = planningIndex(scan, overrides)
    samples.push(indexValue)
    counts[bandFor(indexValue)] += 1
  }

  samples.sort((a, b) => a - b)
  const percentile = (fraction: number) => {
    const value = samples[Math.min(samples.length - 1, Math.floor(samples.length * fraction))]
    if (value === undefined) throw new Error('Unable to calculate a percentile without scenario samples.')
    return value
  }

  const bandStability = counts[expectedBand] / sampleCount
  const verificationQueue = scan.measurements
    .filter(measurement => measurement.source !== 'manual')
    .map(measurement => {
      const rawConfidence = measurement.rawConfidence ?? measurement.confidence
      const confidence = effectiveConfidence(measurement, confidenceOverrides)
      const spread = uncertaintyFraction(confidence)
      const lowIndex = planningIndex(scan, { [measurement.id]: measurement.value * (1 - spread) })
      const highIndex = planningIndex(scan, { [measurement.id]: measurement.value * (1 + spread) })
      const impactPercent = Math.abs(highIndex - lowIndex) / Math.max(1, baselineIndex)
      const priorityScore = impactPercent * (1 - confidence) * 100
      const calibrationApplied = confidenceOverrides[measurement.id] !== undefined
      return {
        measurementId: measurement.id,
        label: measurement.label,
        confidence,
        rawConfidence,
        calibratedConfidence: calibrationApplied ? confidence : undefined,
        calibrationApplied,
        impactPercent: impactPercent * 100,
        priorityScore,
        reason: confidence < 0.75 && impactPercent > 0.03
          ? 'Lower reliability and meaningful downstream sensitivity.'
          : impactPercent > 0.08
            ? 'High downstream sensitivity even with acceptable reliability.'
            : 'Lower expected decision impact than the measurements ranked above it.'
      }
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || a.measurementId.localeCompare(b.measurementId))

  const stabilityLabel = bandStability >= 0.9 ? 'stable' : bandStability >= 0.72 ? 'watch' : 'unstable'
  const topPriority = verificationQueue[0]

  return {
    baselineIndex: Math.round(baselineIndex),
    expectedBand,
    bandStability,
    stabilityLabel,
    likelyRange: { low: Math.round(percentile(0.05)), high: Math.round(percentile(0.95)) },
    bandDistribution: {
      compact: counts.compact / sampleCount,
      standard: counts.standard / sampleCount,
      'high-capacity': counts['high-capacity'] / sampleCount
    },
    verificationQueue,
    scenarioCount: sampleCount,
    summary: topPriority && topPriority.priorityScore > 0.1
      ? `Verify ${topPriority.label.toLowerCase()} first; it currently has the highest expected decision impact.`
      : 'The current recommendation is not highly sensitive to any unresolved measurement.'
  }
}
