import { describe, expect, it } from 'vitest'
import { analyzeCaptureSession } from '../shared/capture-analysis'

const good = (targetType: string) => ({
  targetType,
  qualityBucket: 'good' as const,
  brightnessScore: 0.5,
  sharpnessScore: 0.7,
  contrastScore: 0.6
})

describe('captured view analysis', () => {
  it('only reports ready when every required real view is accepted', () => {
    const result = analyzeCaptureSession([
      good('room_overview'),
      good('opposite_corner'),
      good('ceiling_edge')
    ])
    expect(result.status).toBe('ready')
    expect(result.coverage).toBe(1)
    expect(result.acceptedViewCount).toBe(3)
    expect(result.missingTargets).toEqual([])
  })

  it('does not count a rejected frame as usable coverage', () => {
    const result = analyzeCaptureSession([
      good('room_overview'),
      good('opposite_corner'),
      { ...good('ceiling_edge'), qualityBucket: 'recapture_recommended' as const }
    ])
    expect(result.status).toBe('recapture_required')
    expect(result.coverage).toBeCloseTo(2 / 3)
    expect(result.missingTargets).toEqual(['ceiling_edge'])
    expect(result.rejectedTargets).toEqual(['ceiling_edge'])
  })

  it('keeps only the latest evidence for a repeated target', () => {
    const result = analyzeCaptureSession([
      { ...good('room_overview'), qualityBucket: 'recapture_recommended' as const },
      good('room_overview'),
      good('opposite_corner'),
      good('ceiling_edge')
    ])
    expect(result.status).toBe('ready')
    expect(result.rejectedTargets).toEqual([])
  })
})
