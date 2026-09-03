import type { FrameQualityBucket } from './frame-quality'

export const REQUIRED_CAPTURE_TARGETS = [
  'room_overview',
  'opposite_corner',
  'ceiling_edge'
] as const

export type RequiredCaptureTarget = typeof REQUIRED_CAPTURE_TARGETS[number]

export interface CaptureViewEvidence {
  targetType: string
  qualityBucket: FrameQualityBucket
  brightnessScore: number
  sharpnessScore: number
  contrastScore: number
}

export interface CaptureSessionAnalysis {
  status: 'ready' | 'needs_more_views' | 'recapture_required'
  acceptedViewCount: number
  coverage: number
  qualityScore: number
  missingTargets: RequiredCaptureTarget[]
  rejectedTargets: string[]
  summary: string
}

const average = (values: number[]) => values.length
  ? values.reduce((total, value) => total + value, 0) / values.length
  : 0

/**
 * Evaluates the evidence that was actually captured. It deliberately makes no
 * claim about absolute dimensions, which cannot be recovered reliably from
 * arbitrary monocular phone photos without scale or depth data.
 */
export const analyzeCaptureSession = (
  views: readonly CaptureViewEvidence[]
): CaptureSessionAnalysis => {
  const latestByTarget = new Map<string, CaptureViewEvidence>()
  views.forEach(view => latestByTarget.set(view.targetType, view))

  const accepted = [...latestByTarget.values()].filter(view => view.qualityBucket !== 'recapture_recommended')
  const rejectedTargets = [...latestByTarget.values()]
    .filter(view => view.qualityBucket === 'recapture_recommended')
    .map(view => view.targetType)
  const missingTargets = REQUIRED_CAPTURE_TARGETS.filter(target =>
    !accepted.some(view => view.targetType === target)
  )
  const coverage = accepted.filter(view =>
    REQUIRED_CAPTURE_TARGETS.includes(view.targetType as RequiredCaptureTarget)
  ).length / REQUIRED_CAPTURE_TARGETS.length
  const visualQuality = average(accepted.map(view =>
    (view.brightnessScore * 0.25) + (view.sharpnessScore * 0.45) + (view.contrastScore * 0.3)
  ))
  const qualityScore = Math.min(1, Math.max(0, (visualQuality * 0.7) + (coverage * 0.3)))

  if (rejectedTargets.length) {
    return {
      status: 'recapture_required',
      acceptedViewCount: accepted.length,
      coverage,
      qualityScore,
      missingTargets,
      rejectedTargets,
      summary: 'At least one view needs to be captured again before analysis.'
    }
  }
  if (missingTargets.length) {
    return {
      status: 'needs_more_views',
      acceptedViewCount: accepted.length,
      coverage,
      qualityScore,
      missingTargets,
      rejectedTargets,
      summary: `${missingTargets.length} required view${missingTargets.length === 1 ? '' : 's'} still missing.`
    }
  }
  return {
    status: 'ready',
    acceptedViewCount: accepted.length,
    coverage,
    qualityScore,
    missingTargets,
    rejectedTargets,
    summary: 'The required views are clear enough to support this scan.'
  }
}
