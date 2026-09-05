/** Pinned product model versions — persist with every evidence row. */
export const MEASUREMENT_MODEL_VERSION = 'photo-geometry-v1' as const
export const DEPTH_MODEL_VERSION = 'depth-pro-0.1-9efe5c1' as const
export const STRUCTURE_MODEL_VERSION = 'depth-structure-heuristic-v1' as const
export const GEOMETRY_MODEL_VERSION = 'ransac-room-geometry-v1' as const
export const MEASUREMENT_CONFIDENCE_VERSION = 'photo-confidence-v2' as const
export const DECISION_MODEL_VERSION = 'decision-v1' as const
export const CALIBRATION_VERSION = 'calibration-v1' as const
export const CAPTURE_POLICY_VERSION = 'capture-policy-v1' as const

export const MODEL_VERSIONS = {
  measurement: MEASUREMENT_MODEL_VERSION,
  depth: DEPTH_MODEL_VERSION,
  structure: STRUCTURE_MODEL_VERSION,
  geometry: GEOMETRY_MODEL_VERSION,
  measurementConfidence: MEASUREMENT_CONFIDENCE_VERSION,
  decision: DECISION_MODEL_VERSION,
  calibration: CALIBRATION_VERSION,
  capturePolicy: CAPTURE_POLICY_VERSION
} as const

export type EvidenceOrigin = 'synthetic_demo' | 'real_user_verification' | 'internal_test'

export const PRODUCTION_EVIDENCE_ORIGIN: EvidenceOrigin = 'real_user_verification'
