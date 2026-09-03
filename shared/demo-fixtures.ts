import type { DecisionRoomScan } from './decision-confidence'
import { MEASUREMENT_MODEL_VERSION } from './model-versions'

/**
 * Deterministic synthetic rooms used for demos and tests. Every fixture is
 * marked `synthetic_demo` and must never be presented as a real user scan or
 * counted as production calibration evidence.
 */
export const SYNTHETIC_DEMO_CAPTURE_METHOD = 'simulated-geometry' as const
export const SYNTHETIC_DEMO_ORIGIN = 'synthetic_demo' as const

const CAPTURED_AT = '2026-09-02T12:00:00.000Z'

interface EstimatedInput {
  id: 'width' | 'length' | 'height'
  label: string
  value: number
  low: number
  high: number
  confidence: number
  supportingViewCount?: number
}

const estimated = ({ id, label, value, low, high, confidence, supportingViewCount = 3 }: EstimatedInput) => ({
  id,
  label,
  value,
  unit: 'ft' as const,
  confidence,
  rawConfidence: confidence,
  source: 'estimated' as const,
  uncertaintyLow: low,
  uncertaintyHigh: high,
  provenance: {
    measurementMethod: 'photo_metric_depth' as const,
    depthModelVersion: 'depth-pro-0.1-9efe5c1',
    geometryModelVersion: 'ransac-room-geometry-v1',
    supportingEvidenceIds: Array.from({ length: supportingViewCount }, (_, index) => `demo-view-${index + 1}`),
    supportingViewCount
  },
  originalEstimate: {
    value,
    confidence,
    capturedAt: CAPTURED_AT,
    uncertaintyLow: low,
    uncertaintyHigh: high,
    modelVersion: MEASUREMENT_MODEL_VERSION
  }
})

/**
 * The reference demo room. The planning band is settled, but an L-shaped
 * sectional lands between roughly 70% and 85% because the width interval
 * straddles the space the sectional needs. Width is the only dimension that can
 * move that answer, so HomeLens should ask for width and nothing else.
 */
export const createUncertainFitDemoScan = (): DecisionRoomScan => ({
  id: 'scan_demo_uncertain_fit',
  roomId: 'room_demo_living',
  roomName: 'Living Room',
  createdAt: CAPTURED_AT,
  windows: 2,
  doors: 1,
  modelVersion: MEASUREMENT_MODEL_VERSION,
  captureMethod: SYNTHETIC_DEMO_CAPTURE_METHOD,
  deviceFamily: 'demo-phone',
  roomCategory: 'living-area',
  measurements: [
    estimated({ id: 'width', label: 'Width', value: 9.4, low: 8.5, high: 10.3, confidence: 0.77 }),
    estimated({ id: 'length', label: 'Length', value: 19, low: 18.4, high: 19.6, confidence: 0.91 }),
    estimated({ id: 'height', label: 'Ceiling height', value: 8.8, low: 8.5, high: 9.1, confidence: 0.94 })
  ]
})

/**
 * Imperfect measurement confidence that still produces a completely stable
 * decision: the room sits far inside its planning band, so no verification is
 * worth asking for. Uncertain measurement does not mean uncertain decision.
 */
export const createStableDespiteUncertaintyScan = (): DecisionRoomScan => ({
  id: 'scan_demo_stable',
  roomId: 'room_demo_stable',
  roomName: 'Compact bedroom',
  createdAt: CAPTURED_AT,
  windows: 2,
  doors: 1,
  modelVersion: MEASUREMENT_MODEL_VERSION,
  captureMethod: SYNTHETIC_DEMO_CAPTURE_METHOD,
  deviceFamily: 'demo-phone',
  roomCategory: 'bedroom',
  measurements: [
    estimated({ id: 'width', label: 'Width', value: 10, low: 9.1, high: 10.9, confidence: 0.72 }),
    estimated({ id: 'length', label: 'Length', value: 12, low: 10.9, high: 13.1, confidence: 0.7 }),
    estimated({ id: 'height', label: 'Ceiling height', value: 8.2, low: 7.8, high: 8.6, confidence: 0.74 })
  ]
})

/**
 * The opposite case: confidence is reasonable, but the room sits close enough to
 * a planning-band edge that the remaining uncertainty crosses it. High
 * confidence does not make the uncertainty irrelevant.
 */
export const createBoundaryCrossingScan = (): DecisionRoomScan => ({
  id: 'scan_demo_boundary',
  roomId: 'room_demo_boundary',
  roomName: 'Open living area',
  createdAt: CAPTURED_AT,
  windows: 2,
  doors: 1,
  modelVersion: MEASUREMENT_MODEL_VERSION,
  captureMethod: SYNTHETIC_DEMO_CAPTURE_METHOD,
  deviceFamily: 'demo-phone',
  roomCategory: 'living-area',
  measurements: [
    estimated({ id: 'width', label: 'Width', value: 14, low: 13.2, high: 14.8, confidence: 0.82 }),
    estimated({ id: 'length', label: 'Length', value: 20, low: 18.7, high: 21.3, confidence: 0.79 }),
    estimated({ id: 'height', label: 'Ceiling height', value: 8.6, low: 8.2, high: 9, confidence: 0.86 })
  ]
})
