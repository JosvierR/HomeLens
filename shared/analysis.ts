import type { CalibratedConfidenceSuggestion, CalibrationSummary, MeasurementEvidence } from './calibration'
import { calculateCalibrationSummary, suggestCalibratedConfidence } from './calibration'
import type { DecisionConfidenceResult, DecisionRoomScan } from './decision-confidence'
import { calculateDecisionConfidence } from './decision-confidence'
import type { RescueAction } from './scan-rescue'
import { findBestRescueAction } from './scan-rescue'

export interface CalibrationAnalysis {
  status: 'available' | 'raw_fallback'
  summary: CalibrationSummary
  measurements: Record<string, CalibratedConfidenceSuggestion>
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
    reason: 'Calibration is unavailable; raw model confidence is used unchanged.'
  } satisfies CalibratedConfidenceSuggestion])),
  message: 'Calibration is unavailable; analysis continues with raw model confidence.'
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
      const appliedCount = Object.values(measurements).filter(suggestion => suggestion.applied).length
      calibration = {
        status: appliedCount ? 'available' : 'raw_fallback',
        summary: calculateCalibrationSummary(evidence),
        measurements,
        message: appliedCount
          ? `Historical calibration was applied to ${appliedCount} measurement${appliedCount === 1 ? '' : 's'}.`
          : 'Evidence is below the minimum needed for adjustment; raw confidence is preserved.'
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
