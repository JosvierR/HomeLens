/**
 * Next Best Capture — transparent utility ranking for additional evidence.
 *
 * utility ≈ (expectedDecisionStabilityGain × actionReliability) / effortCost
 *
 * This is NOT computer vision. It recommends which capture target is worth
 * collecting next given decision stability and historical capture-policy reliability.
 */

import { z } from 'zod'
import { CAPTURE_POLICY_VERSION } from './model-versions'
import type { DecisionRoomScan } from './decision-confidence'
import type { RescueAction } from './scan-rescue'

export const captureTargetTypeSchema = z.enum([
  'room_overview',
  'opposite_corner',
  'ceiling_edge',
  'ceiling_corner',
  'far_wall',
  'opening_edge',
  'stop'
])

export type CaptureTargetType = z.infer<typeof captureTargetTypeSchema>

export interface CapturePolicyReliability {
  targetType: string
  measurementType?: string
  sampleCount: number
  reliabilityScore: number
  completionRate: number
  meanActualGain: number | null
}

export interface NextCaptureAction {
  kind: 'capture'
  targetType: Exclude<CaptureTargetType, 'stop'>
  relatedMeasurementIds: string[]
  instruction: string
  reason: string
  currentStability: number
  projectedStability: number
  expectedGain: number
  historicalReliability: number
  estimatedEffort: number
  utilityScore: number
  policyVersion: string
}

export interface StopCaptureAction {
  kind: 'stop'
  instruction: string
  reason: string
  currentStability: number
  projectedStability: number
  expectedGain: number
  historicalReliability: number
  estimatedEffort: number
  utilityScore: number
  policyVersion: string
}

export type NextBestCaptureResult = NextCaptureAction | StopCaptureAction

export interface NextBestCaptureOptions {
  targetStability?: number
  minUsefulGain?: number
  minUtility?: number
  existingTargets?: readonly string[]
  policyReliability?: readonly CapturePolicyReliability[]
  policyVersion?: string
}

const DEFAULT_TARGET_STABILITY = 0.9
const DEFAULT_MIN_USEFUL_GAIN = 0.02
const DEFAULT_MIN_UTILITY = 0.01

const EFFORT_BY_TARGET: Record<Exclude<CaptureTargetType, 'stop'>, number> = {
  room_overview: 1,
  opposite_corner: 1.1,
  ceiling_edge: 1.3,
  ceiling_corner: 1.4,
  far_wall: 1.2,
  opening_edge: 1.25
}

const INSTRUCTION_BY_TARGET: Record<Exclude<CaptureTargetType, 'stop'>, string> = {
  room_overview: 'Capture a room overview.',
  opposite_corner: 'Point toward the opposite corner.',
  ceiling_edge: 'Capture the ceiling edge.',
  ceiling_corner: 'Capture the ceiling corner.',
  far_wall: 'Capture the far wall.',
  opening_edge: 'Capture the opening edge.'
}

const targetForMeasurement = (measurementId: string): Exclude<CaptureTargetType, 'stop'> => {
  if (measurementId === 'height') return 'ceiling_corner'
  if (measurementId === 'length') return 'far_wall'
  if (measurementId === 'width') return 'opposite_corner'
  return 'room_overview'
}

const reliabilityFor = (
  targetType: string,
  measurementId: string | undefined,
  policy: readonly CapturePolicyReliability[] | undefined
): number => {
  if (!policy?.length) return 0.7
  const exact = policy.find(item =>
    item.targetType === targetType
    && (!measurementId || item.measurementType === measurementId)
  )
  if (exact && exact.sampleCount >= 10) return Math.min(1, Math.max(0.2, exact.reliabilityScore))
  const byTarget = policy.find(item => item.targetType === targetType && !item.measurementType)
  if (byTarget && byTarget.sampleCount >= 10) return Math.min(1, Math.max(0.2, byTarget.reliabilityScore))
  return 0.7
}

/**
 * Rank capture actions from Scan Rescue verification priorities.
 * Returns STOP when stability is enough, gain is negligible, or no useful action remains.
 */
export const recommendNextBestCapture = (
  scan: DecisionRoomScan,
  rescue: RescueAction,
  options: NextBestCaptureOptions = {}
): NextBestCaptureResult => {
  const targetStability = options.targetStability ?? DEFAULT_TARGET_STABILITY
  const minUsefulGain = options.minUsefulGain ?? DEFAULT_MIN_USEFUL_GAIN
  const minUtility = options.minUtility ?? DEFAULT_MIN_UTILITY
  const policyVersion = options.policyVersion ?? CAPTURE_POLICY_VERSION
  const existing = new Set(options.existingTargets ?? [])
  const currentStability = rescue.currentStability

  const stop = (reason: string): StopCaptureAction => ({
    kind: 'stop',
    instruction: 'That is enough for now.',
    reason,
    currentStability,
    projectedStability: currentStability,
    expectedGain: 0,
    historicalReliability: 1,
    estimatedEffort: 1,
    utilityScore: 0,
    policyVersion
  })

  if (currentStability >= targetStability || rescue.status === 'stable') {
    return stop('Decision already meets the target stability.')
  }

  if (!rescue.actions.length) {
    return stop('No supported capture action remains.')
  }

  const candidates = rescue.actions
    .map((action): NextCaptureAction | null => {
      const targetType = targetForMeasurement(action.measurementId)
      if (existing.has(targetType)) return null
      const expectedGain = Math.max(0, action.stabilityGain)
      if (expectedGain < minUsefulGain) return null
      const historicalReliability = reliabilityFor(targetType, action.measurementId, options.policyReliability)
      const estimatedEffort = EFFORT_BY_TARGET[targetType]
      const utilityScore = (expectedGain * historicalReliability) / estimatedEffort
      if (utilityScore < minUtility) return null
      return {
        kind: 'capture',
        targetType,
        relatedMeasurementIds: [action.measurementId],
        instruction: INSTRUCTION_BY_TARGET[targetType],
        reason: action.reason,
        currentStability: action.currentStability,
        projectedStability: action.projectedStability,
        expectedGain,
        historicalReliability,
        estimatedEffort,
        utilityScore,
        policyVersion
      }
    })
    .filter((item): item is NextCaptureAction => item !== null)
    .sort((a, b) => b.utilityScore - a.utilityScore)

  if (!candidates.length) {
    return stop('Remaining actions have poor expected utility or evidence is already sufficient.')
  }

  // Prefer room overview first if nothing captured yet.
  if (!existing.size && !candidates.some(item => item.targetType === 'room_overview')) {
    const overviewReliability = reliabilityFor('room_overview', undefined, options.policyReliability)
    return {
      kind: 'capture',
      targetType: 'room_overview',
      relatedMeasurementIds: scan.measurements.map(item => item.id),
      instruction: INSTRUCTION_BY_TARGET.room_overview,
      reason: 'An overview frame establishes room geometry before targeting uncertain dimensions.',
      currentStability,
      projectedStability: Math.min(1, currentStability + 0.03),
      expectedGain: 0.03,
      historicalReliability: overviewReliability,
      estimatedEffort: EFFORT_BY_TARGET.room_overview,
      utilityScore: (0.03 * overviewReliability) / EFFORT_BY_TARGET.room_overview,
      policyVersion
    }
  }

  return candidates[0]!
}
