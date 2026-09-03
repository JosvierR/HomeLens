import type {
  CalibratedConfidenceSuggestion,
  CalibrationEvidenceOrigin,
  CalibrationSummary,
  MeasurementEvidence
} from './calibration'
import { calculateCalibrationSummary, suggestCalibratedConfidence } from './calibration'
import type { DecisionConfidenceResult, DecisionRoomScan } from './decision-confidence'
import { calculateDecisionConfidence } from './decision-confidence'
import type { RescueAction } from './scan-rescue'
import { findBestRescueAction } from './scan-rescue'

export interface CalibrationAnalysis {
  status: 'available' | 'raw_fallback'
  summary: CalibrationSummary
  measurements: Record<string, CalibratedConfidenceSuggestion>
  /** Origin of the evidence actually used, so the UI never dresses synthetic history as production learning. */
  origin: CalibrationEvidenceOrigin
  message: string
}

export interface HomeLensAnalysisResult {
  decision: DecisionConfidenceResult
  rescue: RescueAction
  calibration: CalibrationAnalysis
}

const rawFallback = (scan: DecisionRoomScan): CalibrationAnalysis => ({
  status: 'raw_fallback',
  summary: calculateCalibrationSummary([]),
  measurements: Object.fromEntries(scan.measurements.map(measurement => [measurement.id, {
    rawConfidence: measurement.rawConfidence ?? measurement.confidence,
    calibratedConfidence: measurement.rawConfidence ?? measurement.confidence,
    applied: false,
    scope: 'raw_fallback',
    sampleCount: 0,
    quality: 'insufficient',
    demoEvidence: false,
    syntheticSampleCount: 0,
    productionSampleCount: 0,
    reason: 'Calibration is unavailable; the original model confidence is used unchanged.'
  } satisfies CalibratedConfidenceSuggestion])),
  origin: 'none',
  message: 'Calibration is unavailable; analysis continues with the original model confidence.'
})

export const calculateHomeLensAnalysis = (
  scan: DecisionRoomScan,
  evidence: readonly MeasurementEvidence[],
  options: { disableCalibration?: boolean } = {}
): HomeLensAnalysisResult => {
  let calibration = rawFallback(scan)
  if (!options.disableCalibration) {
    try {
      const measurements = Object.fromEntries(scan.measurements.map(measurement => {
        const rawConfidence = measurement.rawConfidence ?? measurement.originalEstimate?.confidence ?? measurement.confidence
        const suggestion = suggestCalibratedConfidence(rawConfidence, evidence, {
          measurementType: measurement.id,
          modelVersion: scan.modelVersion,
          captureMethod: scan.captureMethod,
          deviceFamily: scan.deviceFamily,
          roomCategory: scan.roomCategory
        })
        return [measurement.id, suggestion]
      }))
      const applied = Object.values(measurements).filter(suggestion => suggestion.applied)
      const synthetic = applied.some(suggestion => suggestion.demoEvidence)
      const production = applied.some(suggestion => suggestion.productionSampleCount > 0)
      calibration = {
        status: applied.length ? 'available' : 'raw_fallback',
        summary: calculateCalibrationSummary(evidence),
        measurements,
        origin: !applied.length
          ? 'none'
          : synthetic && production
            ? 'mixed'
            : synthetic ? 'synthetic_demo' : 'real_user_verification',
        message: !applied.length
          ? 'Not enough real verified history yet; the original model confidence is preserved.'
          : synthetic
            ? `Calibration preview applied to ${applied.length} measurement${applied.length === 1 ? '' : 's'} using synthetic history.`
            : `Historical calibration was applied to ${applied.length} measurement${applied.length === 1 ? '' : 's'}.`
      }
    } catch {
      calibration = rawFallback(scan)
    }
  }

  const confidenceOverrides = Object.fromEntries(
    Object.entries(calibration.measurements)
      .filter(([, suggestion]) => suggestion.applied)
      .map(([measurementId, suggestion]) => [measurementId, suggestion.calibratedConfidence])
  )
  const decision = calculateDecisionConfidence(scan, 600, { confidenceOverrides })
  const rescue = findBestRescueAction(scan, 0.9, { calibration: calibration.measurements })
  return { decision, rescue, calibration }
}
