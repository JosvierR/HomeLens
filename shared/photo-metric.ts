import { z } from 'zod'

export const METERS_TO_FEET = 3.280839895
export const PHOTO_MEASUREMENT_MODEL_VERSION = 'photo-geometry-v1' as const
export const DEPTH_MODEL_VERSION = 'depth-pro-0.1-9efe5c1' as const
export const STRUCTURE_MODEL_VERSION = 'depth-structure-heuristic-v1' as const
export const GEOMETRY_MODEL_VERSION = 'ransac-room-geometry-v1' as const
export const MEASUREMENT_CONFIDENCE_VERSION = 'photo-confidence-v2' as const

const scoreSchema = z.number().finite().min(0).max(1)
const positiveMetricSchema = z.number().finite().positive().max(100)
const artifactReferenceSchema = z.string().trim().min(1).max(500).refine(
  value => !/^https?:\/\//i.test(value),
  'Artifact references must be opaque and must not contain a signed or public URL.'
)

export const captureOrientationSchema = z.enum(['portrait', 'landscape', 'square'])

export const safeCaptureMetadataSchema = z.object({
  captureId: z.string().trim().min(1).max(120),
  capturedAt: z.string().datetime({ offset: true }),
  widthPx: z.number().int().positive().max(8192),
  heightPx: z.number().int().positive().max(8192),
  orientation: captureOrientationSchema,
  deviceFamily: z.string().trim().min(1).max(80),
  cameraIdHash: z.string().trim().min(8).max(128).optional(),
  facingMode: z.string().trim().min(1).max(40).optional(),
  focalLength35mm: z.number().finite().positive().max(1000).optional(),
  estimatedFocalLengthPx: z.number().finite().positive().max(100000).optional(),
  captureTarget: z.string().trim().min(1).max(80),
  brightnessScore: scoreSchema,
  sharpnessScore: scoreSchema,
  contrastScore: scoreSchema,
  qualityBucket: z.enum(['good', 'usable', 'recapture_recommended'])
}).strict()

const hasTimezone = (value: string) => /Z$|[+-]\d{2}:\d{2}$/.test(value)

/** Coerce a persisted capture row into worker metadata. Never throw a raw Zod error to the client. */
export const captureMetadataFromEvidenceRow = (row: {
  id: string
  capture_id?: string | null
  captured_at: string
  width_px: number | string
  height_px: number | string
  orientation?: string | null
  device_family?: string | null
  camera_id_hash?: string | null
  facing_mode?: string | null
  focal_length_35mm?: number | string | null
  estimated_focal_length_px?: number | string | null
  target_type: string
  brightness_score?: number | string | null
  sharpness_score?: number | string | null
  contrast_score?: number | string | null
  quality_bucket?: string | null
}) => {
  const capturedAt = hasTimezone(row.captured_at) ? row.captured_at : new Date(row.captured_at).toISOString()
  const widthPx = Math.round(Number(row.width_px))
  const heightPx = Math.round(Number(row.height_px))
  const cameraIdHash = row.camera_id_hash && row.camera_id_hash.length >= 8 ? row.camera_id_hash : undefined
  const optionalPositive = (value: number | string | null | undefined) => {
    if (value == null || value === '') return undefined
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? number : undefined
  }
  const optionalScore = (value: number | string | null | undefined, fallback: number) => {
    if (value == null || value === '') return fallback
    const number = Number(value)
    return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback
  }
  return safeCaptureMetadataSchema.parse({
    captureId: row.capture_id || row.id,
    capturedAt,
    widthPx,
    heightPx,
    orientation: row.orientation === 'portrait' || row.orientation === 'landscape' || row.orientation === 'square'
      ? row.orientation
      : widthPx > heightPx ? 'landscape' : 'portrait',
    deviceFamily: row.device_family || 'web-camera',
    cameraIdHash,
    facingMode: row.facing_mode || undefined,
    focalLength35mm: optionalPositive(row.focal_length_35mm),
    estimatedFocalLengthPx: optionalPositive(row.estimated_focal_length_px),
    captureTarget: row.target_type,
    brightnessScore: optionalScore(row.brightness_score, 0.5),
    sharpnessScore: optionalScore(row.sharpness_score, 0.5),
    contrastScore: optionalScore(row.contrast_score, 0.5),
    qualityBucket: row.quality_bucket === 'good' || row.quality_bucket === 'usable' || row.quality_bucket === 'recapture_recommended'
      ? row.quality_bucket
      : 'usable'
  })
}

export const metricDepthResultSchema = z.object({
  evidenceId: z.string().trim().min(1).max(120),
  modelName: z.string().trim().min(1).max(120),
  modelVersion: z.string().trim().min(1).max(120),
  depthMapReference: artifactReferenceSchema,
  estimatedFocalLengthPx: z.number().finite().positive().max(100000),
  minDepthMeters: positiveMetricSchema,
  maxDepthMeters: positiveMetricSchema,
  processingTimeMs: z.number().int().nonnegative().max(600000),
  qualityScore: scoreSchema,
  confidence: scoreSchema,
  createdAt: z.string().datetime({ offset: true })
}).strict().superRefine((result, context) => {
  if (result.maxDepthMeters <= result.minDepthMeters) {
    context.addIssue({ code: 'custom', path: ['maxDepthMeters'], message: 'Maximum depth must exceed minimum depth.' })
  }
})

export const imagePointSchema = z.object({
  u: z.number().finite().nonnegative(),
  v: z.number().finite().nonnegative(),
  confidence: scoreSchema
}).strict()

export const roomStructureObservationSchema = z.object({
  evidenceId: z.string().trim().min(1).max(120),
  modelName: z.string().trim().min(1).max(120),
  modelVersion: z.string().trim().min(1).max(120),
  floorMaskReference: artifactReferenceSchema.optional(),
  ceilingMaskReference: artifactReferenceSchema.optional(),
  wallMaskReferences: z.array(artifactReferenceSchema).max(12).default([]),
  openingMaskReferences: z.array(artifactReferenceSchema).max(40).default([]),
  cornerPoints: z.array(imagePointSchema).max(100).default([]),
  vanishingPoints: z.array(imagePointSchema).max(6).default([]),
  floorConfidence: scoreSchema,
  ceilingConfidence: scoreSchema,
  wallConfidence: scoreSchema,
  openingConfidence: scoreSchema,
  rectangularityConfidence: scoreSchema,
  qualityScore: scoreSchema,
  createdAt: z.string().datetime({ offset: true })
}).strict()

export const vector3Schema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite()
])

export const planeEstimateSchema = z.object({
  evidenceId: z.string().trim().min(1).max(120),
  kind: z.enum(['floor', 'ceiling', 'left_wall', 'right_wall', 'back_wall', 'unknown_wall']),
  normal: vector3Schema,
  offset: z.number().finite(),
  inlierCount: z.number().int().nonnegative(),
  residualErrorMeters: z.number().finite().nonnegative().max(20),
  confidence: scoreSchema,
  modelVersion: z.string().trim().min(1).max(120)
}).strict()

export const measurementSignalSchema = z.object({
  depthQuality: scoreSchema,
  structuralConfidence: scoreSchema,
  geometryFitQuality: scoreSchema,
  imageQuality: scoreSchema,
  distanceQuality: scoreSchema,
  occlusionQuality: scoreSchema,
  geometryCompleteness: scoreSchema
}).strict()

export const measurementObservationSchema = z.object({
  evidenceId: z.string().trim().min(1).max(120),
  measurementType: z.enum(['width', 'length', 'height']),
  estimatedValueFeet: z.number().finite().positive().max(100),
  confidence: scoreSchema,
  uncertaintyLowFeet: z.number().finite().positive().max(100),
  uncertaintyHighFeet: z.number().finite().positive().max(100),
  geometryFitErrorMeters: z.number().finite().nonnegative().max(20),
  signals: measurementSignalSchema,
  modelVersion: z.string().trim().min(1).max(120),
  createdAt: z.string().datetime({ offset: true })
}).strict().superRefine((observation, context) => {
  if (observation.uncertaintyLowFeet > observation.estimatedValueFeet) {
    context.addIssue({ code: 'custom', path: ['uncertaintyLowFeet'], message: 'Lower bound cannot exceed the estimate.' })
  }
  if (observation.uncertaintyHighFeet < observation.estimatedValueFeet) {
    context.addIssue({ code: 'custom', path: ['uncertaintyHighFeet'], message: 'Upper bound cannot be below the estimate.' })
  }
})

export const fusedPhotoMeasurementSchema = z.object({
  measurementType: z.enum(['width', 'length', 'height']),
  label: z.string().trim().min(1).max(120),
  valueFeet: z.number().finite().positive().max(100),
  confidence: scoreSchema,
  uncertaintyLowFeet: z.number().finite().positive().max(100),
  uncertaintyHighFeet: z.number().finite().positive().max(100),
  supportingEvidenceIds: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  supportingViewCount: z.number().int().min(1).max(20),
  multiViewConsistency: scoreSchema,
  rawGeometryConfidence: scoreSchema,
  measurementMethod: z.literal('photo_metric_depth'),
  depthModelVersion: z.string().trim().min(1).max(120),
  structureModelVersion: z.string().trim().min(1).max(120),
  geometryModelVersion: z.string().trim().min(1).max(120),
  confidenceModelVersion: z.string().trim().min(1).max(120)
}).strict()

export const photoRoomEstimateSchema = z.object({
  status: z.enum(['estimated', 'partial', 'insufficient', 'irregular']),
  shape: z.enum(['rectangular', 'near_rectangular', 'irregular', 'unknown']),
  rectangularityConfidence: scoreSchema,
  measurements: z.array(fusedPhotoMeasurementSchema).max(3),
  missingMeasurements: z.array(z.enum(['width', 'length', 'height'])).max(3),
  reason: z.string().trim().min(1).max(500),
  modelVersion: z.literal(PHOTO_MEASUREMENT_MODEL_VERSION),
  createdAt: z.string().datetime({ offset: true })
}).strict()

export const photoMetricCallbackSchema = z.object({
  jobId: z.string().uuid(),
  scanId: z.string().uuid(),
  status: z.enum(['succeeded', 'partial', 'insufficient', 'irregular', 'failed']),
  depthResults: z.array(metricDepthResultSchema).max(20).default([]),
  structureObservations: z.array(roomStructureObservationSchema).max(20).default([]),
  planeEstimates: z.array(planeEstimateSchema).max(100).default([]),
  measurementObservations: z.array(measurementObservationSchema).max(100).default([]),
  errorCode: z.string().trim().min(1).max(80).optional(),
  errorMessage: z.string().trim().min(1).max(500).optional(),
  completedAt: z.string().datetime({ offset: true })
}).strict().superRefine((result, context) => {
  if (result.status === 'failed' && !result.errorMessage) {
    context.addIssue({ code: 'custom', path: ['errorMessage'], message: 'Failed inference must include an error message.' })
  }
})

export type SafeCaptureMetadata = z.infer<typeof safeCaptureMetadataSchema>
export type MetricDepthResult = z.infer<typeof metricDepthResultSchema>
export type RoomStructureObservation = z.infer<typeof roomStructureObservationSchema>
export type PlaneEstimate = z.infer<typeof planeEstimateSchema>
export type MeasurementObservation = z.infer<typeof measurementObservationSchema>
export type FusedPhotoMeasurement = z.infer<typeof fusedPhotoMeasurementSchema>
export type PhotoRoomEstimate = z.infer<typeof photoRoomEstimateSchema>
export type PhotoMetricCallback = z.infer<typeof photoMetricCallbackSchema>

