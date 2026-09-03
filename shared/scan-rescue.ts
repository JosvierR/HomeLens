import type { DecisionRoomScan } from './decision-confidence'
import { calculateDecisionConfidence } from './decision-confidence'

export interface RescueAction {
  status: 'stable' | 'needs_verification'
  measurementId?: string
  label?: string
  reason: string
  currentStability: number
  targetStability: number
  projectedStability?: number
}

export const recommendScanRescue = (scan: DecisionRoomScan, targetStability = 0.9): RescueAction => {
  const current = calculateDecisionConfidence(scan)
  if (current.bandStability >= targetStability) return { status: 'stable', reason: 'The current decision is already stable enough; no additional verification is required.', currentStability: current.bandStability, targetStability }

  const candidates = current.verificationQueue.map(item => {
    const candidateScan: DecisionRoomScan = structuredClone(scan)
    const measurement = candidateScan.measurements.find(m => m.id === item.measurementId)
    if (!measurement) return { item, projected: current }
    measurement.confidence = 1
    measurement.source = 'manual'
    return { item, projected: calculateDecisionConfidence(candidateScan) }
  })

  candidates.sort((a, b) => {
    const gainA = a.projected.bandStability - current.bandStability
    const gainB = b.projected.bandStability - current.bandStability
    if (gainA !== gainB) return gainB - gainA
    return b.item.priorityScore - a.item.priorityScore
  })

  const best = candidates[0]
  if (!best) return { status: 'needs_verification', reason: 'Decision is unstable, but no verification candidate is available.', currentStability: current.bandStability, targetStability }

  return {
    status: 'needs_verification',
    measurementId: best.item.measurementId,
    label: best.item.label,
    reason: `Verify ${best.item.label.toLowerCase()} next. It provides the strongest projected improvement in decision stability.`,
    currentStability: current.bandStability,
    targetStability,
    projectedStability: best.projected.bandStability
  }
}
