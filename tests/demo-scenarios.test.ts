import { describe, expect, it } from 'vitest'
import type { DecisionRoomScan } from '../shared/decision-confidence'
import { calculateDecisionConfidence } from '../shared/decision-confidence'
import { findBestRescueAction } from '../shared/scan-rescue'
import { FIT_CATALOG, evaluateItemFit, summarizeRoomFit, evaluateRoomFit } from '../shared/fit-check'
import {
  SYNTHETIC_DEMO_CAPTURE_METHOD,
  createBoundaryCrossingScan,
  createStableDespiteUncertaintyScan,
  createUncertainFitDemoScan
} from '../shared/demo-fixtures'

const sectional = FIT_CATALOG.find(entry => entry.id === 'sectional_sofa')!

const withVerifiedWidth = (scan: DecisionRoomScan, value: number): DecisionRoomScan => ({
  ...scan,
  measurements: scan.measurements.map(measurement => measurement.id === 'width'
    ? { ...measurement, value, confidence: 1, source: 'manual' as const, uncertaintyLow: undefined, uncertaintyHigh: undefined }
    : measurement)
})

describe('reproducible demo scenarios', () => {
  it('keeps every fixture marked as synthetic demo data', () => {
    for (const scan of [createUncertainFitDemoScan(), createStableDespiteUncertaintyScan(), createBoundaryCrossingScan()]) {
      expect(scan.captureMethod).toBe(SYNTHETIC_DEMO_CAPTURE_METHOD)
      expect(() => calculateDecisionConfidence(scan, 600)).not.toThrow()
    }
  })

  it('puts the sectional in genuinely undecided territory and blames width', () => {
    const scan = createUncertainFitDemoScan()
    const result = evaluateItemFit(scan, sectional)

    expect(result.verdict).toBe('uncertain')
    expect(result.probability).toBeGreaterThan(0.6)
    expect(result.probability).toBeLessThan(0.9)
    expect(result.criticalMeasurement?.measurementId).toBe('width')
    expect(summarizeRoomFit(evaluateRoomFit(scan)).decidingMeasurementId).toBe('width')
  })

  it('resolves the sectional to a definite yes when width is taped high', () => {
    const result = evaluateItemFit(withVerifiedWidth(createUncertainFitDemoScan(), 9.8), sectional)

    expect(result.verdict).toBe('fits')
    expect(result.probability).toBe(1)
    expect(result.criticalMeasurement).toBeNull()
  })

  it('resolves the sectional to a definite no when width is taped low', () => {
    const result = evaluateItemFit(withVerifiedWidth(createUncertainFitDemoScan(), 8.9), sectional)

    expect(result.verdict).toBe('does_not_fit')
    expect(result.probability).toBe(0)
    expect(result.criticalMeasurement).toBeNull()
  })

  it('preserves the photo estimate after the width is verified', () => {
    const verifiedScan = withVerifiedWidth(createUncertainFitDemoScan(), 9.8)
    const width = verifiedScan.measurements.find(measurement => measurement.id === 'width')!

    expect(width.source).toBe('manual')
    expect(width.originalEstimate?.value).toBe(9.4)
    expect(width.originalEstimate?.confidence).toBe(0.77)
    expect(width.provenance?.measurementMethod).toBe('photo_metric_depth')
    expect(width.provenance?.supportingViewCount).toBe(3)
  })

  it('asks for no verification when uncertain measurements still give one answer', () => {
    const scan = createStableDespiteUncertaintyScan()
    const decision = calculateDecisionConfidence(scan, 600)
    const rescue = findBestRescueAction(scan, 0.9)

    expect(scan.measurements.every(measurement => measurement.confidence < 0.8)).toBe(true)
    expect(decision.bandStability).toBe(1)
    expect(rescue.status).toBe('stable')
    expect(rescue.actions).toHaveLength(0)
  })

  it('asks for verification when decent confidence still straddles a planning band', () => {
    const scan = createBoundaryCrossingScan()
    const decision = calculateDecisionConfidence(scan, 600)
    const rescue = findBestRescueAction(scan, 0.9)

    expect(scan.measurements.every(measurement => measurement.confidence >= 0.75)).toBe(true)
    expect(decision.bandStability).toBeLessThan(0.9)
    expect(decision.bandDistribution[decision.expectedBand]).toBeLessThan(1)
    expect(rescue.status).toBe('needs_verification')
    expect(rescue.measurementId).toBeTruthy()
    expect(rescue.projectedStability).toBeGreaterThan(rescue.currentStability)
  })
})
