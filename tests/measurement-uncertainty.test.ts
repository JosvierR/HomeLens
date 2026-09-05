import { describe, expect, it } from 'vitest'
import {
  MAX_RELATIVE_HALF_WIDTH,
  boundsFromConfidence,
  confidenceFromHalfWidth,
  fuseUncertainty,
  halfWidthFromConfidence,
  relativeHalfWidthFromConfidence
} from '../shared/measurement-uncertainty'

describe('confidence ↔ uncertainty mapping', () => {
  it('treats confidence and relative half-width as inverses', () => {
    for (const confidence of [0, 0.34, 0.5, 0.77, 0.91, 1]) {
      const relative = relativeHalfWidthFromConfidence(confidence)
      expect(confidenceFromHalfWidth(10, 10 * relative)).toBeCloseTo(confidence, 10)
      expect(halfWidthFromConfidence(12.4, confidence)).toBeCloseTo(12.4 * relative, 10)
    }
  })

  it('maps 79% confidence to about ±6% of the value, never a contradictory range', () => {
    const bounds = boundsFromConfidence(12.4, 0.79)
    const half = (bounds.high - bounds.low) / 2
    expect(half / 12.4).toBeCloseTo((1 - 0.79) * MAX_RELATIVE_HALF_WIDTH, 5)
    expect(confidenceFromHalfWidth(12.4, half)).toBeCloseTo(0.79, 5)
  })

  it('gives a verified-like score only to a vanishing interval', () => {
    expect(confidenceFromHalfWidth(10, 0)).toBe(1)
    expect(boundsFromConfidence(10, 1)).toEqual({ low: 10, high: 10 })
  })
})

describe('fuseUncertainty', () => {
  it('reads confidence from the fused 90% interval', () => {
    const fused = fuseUncertainty({
      valueFeet: 12.7,
      observationValues: [12.6, 12.7, 12.8],
      observationHalfWidths: [0.35, 0.35, 0.35]
    })
    const half = (fused.uncertaintyHighFeet - fused.uncertaintyLowFeet) / 2
    expect(fused.confidence).toBeCloseTo(confidenceFromHalfWidth(12.7, half), 10)
    expect(fused.uncertaintyLowFeet).toBeLessThan(12.7)
    expect(fused.uncertaintyHighFeet).toBeGreaterThan(12.7)
  })

  it('widens the interval and lowers confidence when views disagree', () => {
    const agreed = fuseUncertainty({
      valueFeet: 12.7,
      observationValues: [12.65, 12.7, 12.75],
      observationHalfWidths: [0.3, 0.3, 0.3]
    })
    const disagreed = fuseUncertainty({
      valueFeet: 12.7,
      observationValues: [11.4, 12.7, 14.1],
      observationHalfWidths: [0.3, 0.3, 0.3]
    })
    expect(disagreed.confidence).toBeLessThan(agreed.confidence)
    expect(disagreed.uncertaintyHighFeet - disagreed.uncertaintyLowFeet)
      .toBeGreaterThan(agreed.uncertaintyHighFeet - agreed.uncertaintyLowFeet)
  })
})
