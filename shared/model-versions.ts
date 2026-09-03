/** Pinned product model versions — persist with every evidence row. */
export const MEASUREMENT_MODEL_VERSION = 'geometry-v1' as const
export const DECISION_MODEL_VERSION = 'decision-v1' as const
export const CALIBRATION_VERSION = 'calibration-v1' as const
export const CAPTURE_POLICY_VERSION = 'capture-policy-v1' as const

export const MODEL_VERSIONS = {
  measurement: MEASUREMENT_MODEL_VERSION,
  decision: DECISION_MODEL_VERSION,
  calibration: CALIBRATION_VERSION,
  capturePolicy: CAPTURE_POLICY_VERSION
} as const

export type EvidenceOrigin = 'synthetic_demo' | 'real_user_verification' | 'internal_test'

export const PRODUCTION_EVIDENCE_ORIGIN: EvidenceOrigin = 'real_user_verification'
