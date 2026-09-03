import {
  DEPTH_MODEL_VERSION,
  GEOMETRY_MODEL_VERSION,
  MEASUREMENT_CONFIDENCE_VERSION,
  PHOTO_MEASUREMENT_MODEL_VERSION,
  STRUCTURE_MODEL_VERSION,
  measurementObservationSchema,
  photoRoomEstimateSchema
} from './photo-metric'
import type { FusedPhotoMeasurement, MeasurementObservation, PhotoRoomEstimate } from './photo-metric'

const LABELS = { width: 'Width', length: 'Length', height: 'Ceiling height' } as const
const clamp = (value: number) => Math.min(1, Math.max(0, value))
const mean = (values: readonly number[]) => values.reduce((total, value) => total + value, 0) / Math.max(1, values.length)
const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

const weightedGeometricMean = (signals: MeasurementObservation['signals']) => {
  const weighted = [
    [signals.depthQuality, 0.18],
    [signals.structuralConfidence, 0.17],
    [signals.geometryFitQuality, 0.18],
    [signals.imageQuality, 0.11],
    [signals.distanceQuality, 0.08],
    [signals.occlusionQuality, 0.1],
    [signals.geometryCompleteness, 0.18]
  ] as const
  return Math.exp(weighted.reduce((total, [value, weight]) => total + weight * Math.log(Math.max(0.01, value)), 0))
}

export const calculateMultiViewConsistency = (observations: readonly MeasurementObservation[]) => {
  if (observations.length < 2) return 0.48
  const values = observations.map(item => item.estimatedValueFeet)
  const center = median(values)
  const normalizedDeviation = median(values.map(value => Math.abs(value - center))) / Math.max(center, 0.1)
  const fullSpread = (Math.max(...values) - Math.min(...values)) / Math.max(center, 0.1)
  return clamp(Math.exp(-(normalizedDeviation * 7 + fullSpread * 2.2)))
}

export const fuseMeasurementObservations = (
  input: readonly MeasurementObservation[]
): FusedPhotoMeasurement | null => {
  if (!input.length) return null
  const observations = input.map(item => measurementObservationSchema.parse(item))
  const type = observations[0]!.measurementType
  if (observations.some(item => item.measurementType !== type)) throw new Error('Only observations for one measurement can be fused together.')

  const center = median(observations.map(item => item.estimatedValueFeet))
  const absoluteDeviations = observations.map(item => Math.abs(item.estimatedValueFeet - center))
  const mad = median(absoluteDeviations)
  const outlierLimit = Math.max(center * 0.18, mad * 3, 0.35)
  const retained = observations.filter(item => Math.abs(item.estimatedValueFeet - center) <= outlierLimit)
  const candidates = retained.length ? retained : observations
  const weights = candidates.map(item => {
    const halfRange = Math.max(0.05, (item.uncertaintyHighFeet - item.uncertaintyLowFeet) / 2)
    return Math.max(0.01, item.confidence * weightedGeometricMean(item.signals) / (halfRange * halfRange))
  })
  const weightTotal = weights.reduce((total, value) => total + value, 0)
  const valueFeet = candidates.reduce((total, item, index) => total + item.estimatedValueFeet * weights[index]!, 0) / weightTotal
  const consistency = calculateMultiViewConsistency(observations)
  const viewSupport = clamp(observations.length / 3)
  const rawGeometryConfidence = mean(candidates.map(item => weightedGeometricMean(item.signals)))
  const observationConfidence = mean(candidates.map(item => item.confidence))
  const confidence = clamp(rawGeometryConfidence * 0.45 + observationConfidence * 0.25 + consistency * 0.2 + viewSupport * 0.1)

  const withinViewUncertainty = mean(candidates.map(item =>
    Math.max(item.estimatedValueFeet - item.uncertaintyLowFeet, item.uncertaintyHighFeet - item.estimatedValueFeet)
  ))
  const betweenViewStdDev = Math.sqrt(mean(candidates.map(item => (item.estimatedValueFeet - valueFeet) ** 2)))
  const confidencePenalty = valueFeet * (1 - confidence) * 0.08
  const halfRange = Math.max(0.08, withinViewUncertainty, betweenViewStdDev * 1.645, confidencePenalty)

  return {
    measurementType: type,
    label: LABELS[type],
    valueFeet,
    confidence,
    uncertaintyLowFeet: Math.max(0.1, valueFeet - halfRange),
    uncertaintyHighFeet: Math.min(100, valueFeet + halfRange),
    supportingEvidenceIds: [...new Set(candidates.map(item => item.evidenceId))],
    supportingViewCount: new Set(candidates.map(item => item.evidenceId)).size,
    multiViewConsistency: consistency,
    rawGeometryConfidence,
    measurementMethod: 'photo_metric_depth',
    depthModelVersion: DEPTH_MODEL_VERSION,
    structureModelVersion: STRUCTURE_MODEL_VERSION,
    geometryModelVersion: GEOMETRY_MODEL_VERSION,
    confidenceModelVersion: MEASUREMENT_CONFIDENCE_VERSION
  }
}

export const buildPhotoRoomEstimate = (
  input: readonly MeasurementObservation[],
  rectangularityConfidence: number,
  createdAt = new Date().toISOString()
): PhotoRoomEstimate => {
  const observations = input.map(item => measurementObservationSchema.parse(item))
  const measurements = (['width', 'length', 'height'] as const)
    .map(type => fuseMeasurementObservations(observations.filter(item => item.measurementType === type)))
    .filter((item): item is FusedPhotoMeasurement => item !== null)
  const found = new Set(measurements.map(item => item.measurementType))
  const missingMeasurements = (['width', 'length', 'height'] as const).filter(type => !found.has(type))
  const rectangularity = clamp(rectangularityConfidence)
  const shape = rectangularity >= 0.72 ? 'rectangular' : rectangularity >= 0.52 ? 'near_rectangular' : rectangularity > 0 ? 'irregular' : 'unknown'
  const status = shape === 'irregular'
    ? 'irregular'
    : measurements.length === 3
      ? 'estimated'
      : measurements.length
        ? 'partial'
        : 'insufficient'
  const reason = status === 'estimated'
    ? 'All three dimensions have supported photo-derived observations.'
    : status === 'irregular'
      ? 'The visible planes do not support a rectangular width and length model.'
      : status === 'partial'
        ? `Reliable observations are still missing for ${missingMeasurements.join(' and ')}.`
        : 'The captured images did not produce reliable structural geometry.'

  return photoRoomEstimateSchema.parse({
    status,
    shape,
    rectangularityConfidence: rectangularity,
    measurements,
    missingMeasurements,
    reason,
    modelVersion: PHOTO_MEASUREMENT_MODEL_VERSION,
    createdAt
  })
}

