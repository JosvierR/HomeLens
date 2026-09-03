import { z } from 'zod'

export const DEFAULT_CALIBRATION_TOLERANCE = {
  relativeError: 0.03
} as const

export const DEFAULT_CALIBRATION_MINIMUMS = {
  exactContext: 12,
  measurementType: 12,
  global: 20,
  bucket: 5,
  summary: 20
} as const

const confidenceSchema = z.number().finite().min(0).max(1)
const positiveValueSchema = z.number().finite().positive()
const optionalContextString = z.string().trim().min(1).max(100).optional()

export const measurementEvidenceSchema = z.object({
  id: z.string().trim().min(1).max(160),
  scanId: z.string().trim().min(1).max(120),
  roomId: z.string().trim().min(1).max(120),
  measurementId: z.string().trim().min(1).max(80),
  measurementType: z.string().trim().min(1).max(80),
  estimatedValue: positiveValueSchema,
  estimatedConfidence: confidenceSchema,
  verifiedValue: positiveValueSchema,
  absoluteError: z.number().finite().min(0),
  relativeError: z.number().finite().min(0),
  modelVersion: optionalContextString,
  captureMethod: optionalContextString,
  deviceFamily: optionalContextString,
  roomCategory: optionalContextString,
  verificationSource: z.literal('manual'),
  decisionStabilityBefore: confidenceSchema,
  decisionStabilityAfter: confidenceSchema,
  stabilityGain: z.number().finite().min(-1).max(1),
  createdAt: z.string().datetime({ offset: true }),
  demo: z.boolean().default(false)
}).strict()

export type MeasurementEvidence = z.infer<typeof measurementEvidenceSchema>

export type MeasurementEvidenceInput = Omit<
  MeasurementEvidence,
  'absoluteError' | 'relativeError' | 'stabilityGain' | 'demo'
> & { demo?: boolean }

export interface CalibrationTolerance {
  /** Illustrative prototype tolerance, expressed as relative error against human ground truth. */
  relativeError: number
}

export interface CalibrationBucket {
  index: number
  lowerBound: number
  upperBound: number
  label: string
  sampleCount: number
  averagePredictedConfidence: number | null
  observedSuccessRate: number | null
  meanAbsoluteError: number | null
  meanRelativeError: number | null
  /** Signed predicted minus observed success. Positive values indicate overconfidence. */
  calibrationGap: number | null
  evidenceStatus: 'sufficient' | 'insufficient'
}

export type CalibrationQuality = 'good' | 'moderate' | 'poor' | 'insufficient'

export interface CalibrationSummary {
  sampleCount: number
  expectedCalibrationError: number | null
  quality: CalibrationQuality
  tolerance: CalibrationTolerance
  buckets: CalibrationBucket[]
  demoEvidenceCount: number
}

export interface CalibrationContext {
  measurementType?: string
  modelVersion?: string
  captureMethod?: string
  deviceFamily?: string
  roomCategory?: string
}

export interface CalibratedConfidenceSuggestion {
  rawConfidence: number
  calibratedConfidence: number
  applied: boolean
  scope: 'exact_context' | 'measurement_type' | 'global' | 'raw_fallback'
  sampleCount: number
  quality: CalibrationQuality
  demoEvidence: boolean
  reason: string
}

export interface CalibrationMinimums {
  exactContext: number
  measurementType: number
  global: number
  bucket: number
  summary: number
}

const assertFinitePositive = (value: number, name: string) => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a finite positive number.`)
}

const assertConfidence = (confidence: number) => {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('Confidence must be a finite number between 0 and 1.')
  }
}

const validateTolerance = (tolerance: CalibrationTolerance) => {
  if (!Number.isFinite(tolerance.relativeError) || tolerance.relativeError < 0 || tolerance.relativeError > 1) {
    throw new Error('Relative-error tolerance must be between 0 and 1.')
  }
}

export const calculateAbsoluteError = (estimatedValue: number, verifiedValue: number) => {
  assertFinitePositive(estimatedValue, 'Estimated value')
  assertFinitePositive(verifiedValue, 'Verified value')
  return Math.abs(estimatedValue - verifiedValue)
}

export const calculateRelativeError = (estimatedValue: number, verifiedValue: number) => {
  return calculateAbsoluteError(estimatedValue, verifiedValue) / verifiedValue
}

export const recordEvidence = (input: MeasurementEvidenceInput): MeasurementEvidence => {
  const absoluteError = calculateAbsoluteError(input.estimatedValue, input.verifiedValue)
  const relativeError = calculateRelativeError(input.estimatedValue, input.verifiedValue)
  return measurementEvidenceSchema.parse({
    ...input,
    absoluteError,
    relativeError,
    stabilityGain: input.decisionStabilityAfter - input.decisionStabilityBefore,
    demo: input.demo ?? false
  })
}

export const calculateCalibrationBucket = (confidence: number) => {
  assertConfidence(confidence)
  const index = Math.min(9, Math.floor(confidence * 10))
  return {
    index,
    lowerBound: index / 10,
    upperBound: (index + 1) / 10,
    label: `${index * 10}–${(index + 1) * 10}%`
  }
}

const average = (values: readonly number[]) => values.reduce((total, value) => total + value, 0) / values.length

export const calculateCalibrationSummary = (
  evidenceInput: readonly MeasurementEvidence[],
  tolerance: CalibrationTolerance = DEFAULT_CALIBRATION_TOLERANCE,
  minimums: CalibrationMinimums = DEFAULT_CALIBRATION_MINIMUMS
): CalibrationSummary => {
  validateTolerance(tolerance)
  const evidence = evidenceInput.map(item => measurementEvidenceSchema.parse(item))
  const buckets: CalibrationBucket[] = Array.from({ length: 10 }, (_, index) => {
    const items = evidence.filter(item => calculateCalibrationBucket(item.estimatedConfidence).index === index)
    if (!items.length) {
      return {
        index,
        lowerBound: index / 10,
        upperBound: (index + 1) / 10,
        label: `${index * 10}–${(index + 1) * 10}%`,
        sampleCount: 0,
        averagePredictedConfidence: null,
        observedSuccessRate: null,
        meanAbsoluteError: null,
        meanRelativeError: null,
        calibrationGap: null,
        evidenceStatus: 'insufficient'
      }
    }

    const averagePredictedConfidence = average(items.map(item => item.estimatedConfidence))
    const observedSuccessRate = items.filter(item => item.relativeError <= tolerance.relativeError).length / items.length
    return {
      index,
      lowerBound: index / 10,
      upperBound: (index + 1) / 10,
      label: `${index * 10}–${(index + 1) * 10}%`,
      sampleCount: items.length,
      averagePredictedConfidence,
      observedSuccessRate,
      meanAbsoluteError: average(items.map(item => item.absoluteError)),
      meanRelativeError: average(items.map(item => item.relativeError)),
      calibrationGap: averagePredictedConfidence - observedSuccessRate,
      evidenceStatus: items.length >= minimums.bucket ? 'sufficient' : 'insufficient'
    }
  })

  const populatedBuckets = buckets.filter(bucket => bucket.sampleCount > 0 && bucket.calibrationGap !== null)
  const expectedCalibrationError = evidence.length
    ? populatedBuckets.reduce((total, bucket) => total + Math.abs(bucket.calibrationGap ?? 0) * bucket.sampleCount, 0) / evidence.length
    : null
  const quality: CalibrationQuality = evidence.length < minimums.summary || expectedCalibrationError === null
    ? 'insufficient'
    : expectedCalibrationError <= 0.05
      ? 'good'
      : expectedCalibrationError <= 0.1
        ? 'moderate'
        : 'poor'

  return {
    sampleCount: evidence.length,
    expectedCalibrationError,
    quality,
    tolerance,
    buckets,
    demoEvidenceCount: evidence.filter(item => item.demo).length
  }
}

const contextFields = ['modelVersion', 'captureMethod', 'deviceFamily', 'roomCategory'] as const

const exactContextMatch = (item: MeasurementEvidence, context: CalibrationContext) => {
  if (context.measurementType && item.measurementType !== context.measurementType) return false
  return contextFields.every(field => context[field] === undefined || item[field] === context[field])
}

export const suggestCalibratedConfidence = (
  rawConfidence: number,
  evidenceInput: readonly MeasurementEvidence[],
  context: CalibrationContext = {},
  tolerance: CalibrationTolerance = DEFAULT_CALIBRATION_TOLERANCE,
  minimums: CalibrationMinimums = DEFAULT_CALIBRATION_MINIMUMS
): CalibratedConfidenceSuggestion => {
  assertConfidence(rawConfidence)
  validateTolerance(tolerance)
  const evidence = evidenceInput.map(item => measurementEvidenceSchema.parse(item))
  const targetBucket = calculateCalibrationBucket(rawConfidence).index
  const hasSpecificContext = contextFields.some(field => context[field] !== undefined)

  const candidates: Array<{
    scope: CalibratedConfidenceSuggestion['scope']
    minimum: number
    items: MeasurementEvidence[]
  }> = []

  if (hasSpecificContext) {
    candidates.push({
      scope: 'exact_context',
      minimum: minimums.exactContext,
      items: evidence.filter(item => exactContextMatch(item, context))
    })
  }
  if (context.measurementType) {
    candidates.push({
      scope: 'measurement_type',
      minimum: minimums.measurementType,
      items: evidence.filter(item => item.measurementType === context.measurementType)
    })
  }
  candidates.push({ scope: 'global', minimum: minimums.global, items: [...evidence] })

  for (const candidate of candidates) {
    if (candidate.items.length < candidate.minimum) continue
    const comparable = candidate.items.filter(item => calculateCalibrationBucket(item.estimatedConfidence).index === targetBucket)
    if (comparable.length < minimums.bucket) continue
    const calibratedConfidence = comparable.filter(item => item.relativeError <= tolerance.relativeError).length / comparable.length
    const summary = calculateCalibrationSummary(candidate.items, tolerance, minimums)
    const demoEvidence = comparable.some(item => item.demo)
    const scopeLabel = candidate.scope === 'exact_context'
      ? 'matching capture context'
      : candidate.scope === 'measurement_type'
        ? `verified ${context.measurementType ?? 'measurement'} measurements`
        : 'all verified measurements'
    return {
      rawConfidence,
      calibratedConfidence,
      applied: true,
      scope: candidate.scope,
      sampleCount: comparable.length,
      quality: summary.quality,
      demoEvidence,
      reason: `Based on ${comparable.length} observations${demoEvidence ? ' including synthetic demo evidence' : ''} from ${scopeLabel} in the same confidence range.`
    }
  }

  return {
    rawConfidence,
    calibratedConfidence: rawConfidence,
    applied: false,
    scope: 'raw_fallback',
    sampleCount: 0,
    quality: 'insufficient',
    demoEvidence: false,
    reason: 'Not enough comparable verification evidence; raw model confidence is used unchanged.'
  }
}
