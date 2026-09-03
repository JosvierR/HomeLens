import type { CalibratedConfidenceSuggestion } from './calibration'
import type { DecisionConfidenceResult, DecisionRoomScan, VerificationPriority } from './decision-confidence'
import { calculateDecisionConfidence } from './decision-confidence'

export interface RescueRecommendation {
  measurementId: string
  label: string
  currentConfidence: number
  rawConfidence: number
  calibratedConfidence?: number
  calibrationApplied: boolean
  calibrationSampleCount: number
  calibrationDemoEvidence: boolean
  expectedDecisionImpact: number
  currentStability: number
  projectedStability: number
  stabilityGain: number
  reason: string
}

export interface RescueAction {
  status: 'stable' | 'needs_verification'
  measurementId?: string
  label?: string
  reason: string
  currentStability: number
  targetStability: number
  projectedStability?: number
  stabilityGain?: number
  actions: RescueRecommendation[]
}

export interface ScanRescueOptions {
  calibration?: Readonly<Record<string, CalibratedConfidenceSuggestion>>
  sampleCount?: number
}

const cloneScan = (scan: DecisionRoomScan): DecisionRoomScan => ({
  ...scan,
  measurements: scan.measurements.map(measurement => ({
    ...measurement,
    originalEstimate: measurement.originalEstimate ? { ...measurement.originalEstimate } : undefined,
    verification: measurement.verification ? { ...measurement.verification } : undefined
  }))
})

const confidenceOverridesFor = (
  scan: DecisionRoomScan,
  calibration: ScanRescueOptions['calibration']
) => Object.fromEntries(
  scan.measurements
    .filter(measurement => measurement.source !== 'manual')
    .flatMap(measurement => {
      const suggestion = calibration?.[measurement.id]
      return suggestion?.applied ? [[measurement.id, suggestion.calibratedConfidence] as const] : []
    })
)

const recommendationFor = (
  item: VerificationPriority,
  currentStability: number,
  projectedStability: number,
  calibration?: CalibratedConfidenceSuggestion
): RescueRecommendation => {
  const stabilityGain = projectedStability - currentStability
  const calibrationContext = calibration?.applied
    ? calibration.demoEvidence
      ? ` A calibration preview built from ${calibration.sampleCount} synthetic comparison samples moves confidence from ${Math.round(calibration.rawConfidence * 100)}% to ${Math.round(calibration.calibratedConfidence * 100)}%.`
      : ` Historical evidence adjusts confidence from ${Math.round(calibration.rawConfidence * 100)}% to ${Math.round(calibration.calibratedConfidence * 100)}% (${calibration.sampleCount} comparable verified measurements).`
    : ''
  return {
    measurementId: item.measurementId,
    label: item.label,
    currentConfidence: item.confidence,
    rawConfidence: item.rawConfidence,
    calibratedConfidence: calibration?.applied ? calibration.calibratedConfidence : undefined,
    calibrationApplied: calibration?.applied ?? false,
    calibrationSampleCount: calibration?.applied ? calibration.sampleCount : 0,
    calibrationDemoEvidence: calibration?.applied ? calibration.demoEvidence : false,
    expectedDecisionImpact: item.impactPercent,
    currentStability,
    projectedStability,
    stabilityGain,
    reason: `Verifying ${item.label.toLowerCase()} provides the strongest projected stability gain of the remaining measurements.${calibrationContext}`
  }
}

export const findBestRescueAction = (
  scanInput: DecisionRoomScan,
  targetStability = 0.9,
  options: ScanRescueOptions = {}
): RescueAction => {
  if (!Number.isFinite(targetStability) || targetStability < 0 || targetStability > 1) {
    throw new Error('Target stability must be between 0 and 1.')
  }

  const sampleCount = options.sampleCount ?? 600
  const workingScan = cloneScan(scanInput)
  const initialOverrides = confidenceOverridesFor(workingScan, options.calibration)
  const initial = calculateDecisionConfidence(workingScan, sampleCount, { confidenceOverrides: initialOverrides })

  if (initial.bandStability >= targetStability) {
    return {
      status: 'stable',
      reason: 'The current decision is already stable enough; no additional verification is required.',
      currentStability: initial.bandStability,
      targetStability,
      actions: []
    }
  }

  const actions: RescueRecommendation[] = []
  let current: DecisionConfidenceResult = initial

  while (current.bandStability < targetStability) {
    const unresolved = current.verificationQueue.filter(item => {
      const measurement = workingScan.measurements.find(candidate => candidate.id === item.measurementId)
      return measurement?.source !== 'manual'
    })
    if (!unresolved.length) break

    const candidates = unresolved.map(item => {
      const candidateScan = cloneScan(workingScan)
      const measurement = candidateScan.measurements.find(candidate => candidate.id === item.measurementId)
      if (!measurement) return null
      measurement.confidence = 1
      measurement.source = 'manual'
      const candidateOverrides = confidenceOverridesFor(candidateScan, options.calibration)
      const projected = calculateDecisionConfidence(candidateScan, sampleCount, { confidenceOverrides: candidateOverrides })
      return { item, projected }
    }).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)

    candidates.sort((a, b) => {
      const gainDifference = (b.projected.bandStability - current.bandStability) - (a.projected.bandStability - current.bandStability)
      if (gainDifference !== 0) return gainDifference
      return b.item.priorityScore - a.item.priorityScore || a.item.measurementId.localeCompare(b.item.measurementId)
    })

    const best = candidates[0]
    if (!best || best.projected.bandStability <= current.bandStability) break
    actions.push(recommendationFor(
      best.item,
      current.bandStability,
      best.projected.bandStability,
      options.calibration?.[best.item.measurementId]
    ))

    const verified = workingScan.measurements.find(measurement => measurement.id === best.item.measurementId)
    if (!verified) break
    verified.confidence = 1
    verified.source = 'manual'
    current = best.projected
  }

  const first = actions[0]
  return {
    status: 'needs_verification',
    measurementId: first?.measurementId,
    label: first?.label,
    reason: first
      ? actions.length === 1
        ? first.reason
        : `${first.reason} ${actions.length} sequential verifications are projected to reach the target.`
      : 'The decision is unstable, but no remaining single verification produced a useful stability gain.',
    currentStability: initial.bandStability,
    targetStability,
    projectedStability: first?.projectedStability,
    stabilityGain: first?.stabilityGain,
    actions
  }
}

export const recommendScanRescue = findBestRescueAction
