import { describe, expect, it } from 'vitest'
import { buildPhotoRoomEstimate, calculateMultiViewConsistency, fuseMeasurementObservations } from '../shared/photo-measurement'
import type { MeasurementObservation } from '../shared/photo-metric'

const observation = (evidenceId: string, measurementType: 'width' | 'length' | 'height', value: number): MeasurementObservation => ({
  evidenceId,
  measurementType,
  estimatedValueFeet: value,
  confidence: 0.84,
  uncertaintyLowFeet: value - 0.35,
  uncertaintyHighFeet: value + 0.35,
  geometryFitErrorMeters: 0.03,
  signals: {
    depthQuality: 0.88,
    structuralConfidence: 0.82,
    geometryFitQuality: 0.86,
    imageQuality: 0.9,
    distanceQuality: 0.8,
    occlusionQuality: 0.78,
    geometryCompleteness: 0.84
  },
  modelVersion: 'photo-geometry-v1',
  createdAt: '2026-09-03T12:00:00.000Z'
})

describe('multi-view photo measurement', () => {
  it('fuses consistent observations and preserves supporting views', () => {
    const fused = fuseMeasurementObservations([
      observation('view-1', 'width', 12.6),
      observation('view-2', 'width', 12.8),
      observation('view-3', 'width', 12.7)
    ])
    expect(fused!.valueFeet).toBeCloseTo(12.7, 1)
    expect(fused!.supportingViewCount).toBe(3)
    expect(fused!.multiViewConsistency).toBeGreaterThan(0.9)
    expect(fused!.uncertaintyLowFeet).toBeLessThan(fused!.valueFeet)
    expect(fused!.uncertaintyHighFeet).toBeGreaterThan(fused!.valueFeet)
  })

  it('rejects an outlier view instead of averaging it into the fused estimate', () => {
    const fused = fuseMeasurementObservations([
      observation('view-1', 'width', 12.6),
      observation('view-2', 'width', 12.8),
      observation('view-3', 'width', 19.4)
    ])
    expect(fused!.valueFeet).toBeGreaterThan(12.4)
    expect(fused!.valueFeet).toBeLessThan(13.1)
    expect(fused!.supportingEvidenceIds).not.toContain('view-3')
  })

  it('lowers consistency when views disagree', () => {
    const consistent = calculateMultiViewConsistency([
      observation('a', 'length', 15.7), observation('b', 'length', 15.8), observation('c', 'length', 15.9)
    ])
    const inconsistent = calculateMultiViewConsistency([
      observation('a', 'length', 14.1), observation('b', 'length', 16.8), observation('c', 'length', 15.2)
    ])
    expect(inconsistent).toBeLessThan(consistent)
  })

  it('returns partial or irregular instead of inventing missing dimensions', () => {
    const partial = buildPhotoRoomEstimate([observation('a', 'height', 8.9)], 0.8)
    expect(partial.status).toBe('partial')
    expect(partial.missingMeasurements).toEqual(['width', 'length'])

    const irregular = buildPhotoRoomEstimate([
      observation('a', 'width', 12.7), observation('b', 'length', 15.8), observation('c', 'height', 8.9)
    ], 0.3)
    expect(irregular.status).toBe('irregular')
  })
})

