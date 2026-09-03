import { describe, expect, it } from 'vitest'
import {
  calculateAbsoluteError,
  calculateCalibrationBucket,
  calculateCalibrationSummary,
  calculateRelativeError,
  recordEvidence,
  suggestCalibratedConfidence,
  type MeasurementEvidence
} from '../shared/calibration'

const makeEvidence = (
  index: number,
  confidence: number,
  succeeds: boolean,
  context: Partial<MeasurementEvidence> = {}
) => recordEvidence({
  id: `e-${index}-${context.measurementType ?? 'height'}-${context.deviceFamily ?? 'phone'}`,
  scanId: `scan-${index}`,
  roomId: `room-${index}`,
  measurementId: String(context.measurementType ?? 'height'),
  measurementType: String(context.measurementType ?? 'height'),
  estimatedValue: 10,
  estimatedConfidence: confidence,
  verifiedValue: succeeds ? 10.1 : 11,
  modelVersion: String(context.modelVersion ?? 'v1'),
  captureMethod: String(context.captureMethod ?? 'camera'),
  deviceFamily: String(context.deviceFamily ?? 'phone'),
  roomCategory: String(context.roomCategory ?? 'living-area'),
  verificationSource: 'manual',
  decisionStabilityBefore: 0.7,
  decisionStabilityAfter: 0.9,
  createdAt: '2026-09-02T12:00:00.000Z',
  demo: Boolean(context.demo)
})

const relaxedMinimums = { exactContext: 1, measurementType: 1, global: 1, bucket: 1, summary: 1 }

describe('calibration math', () => {
  it('calculates absolute and relative error against human ground truth', () => {
    expect(calculateAbsoluteError(9.1, 9)).toBeCloseTo(0.1)
    expect(calculateRelativeError(9.1, 9)).toBeCloseTo(0.1 / 9)
  })

  it('assigns boundary confidences to deterministic ten-percent buckets', () => {
    expect(calculateCalibrationBucket(0)).toMatchObject({ index: 0, label: '0–10%' })
    expect(calculateCalibrationBucket(0.1).index).toBe(1)
    expect(calculateCalibrationBucket(1)).toMatchObject({ index: 9, label: '90–100%' })
  })

  it('reports perfect calibration', () => {
    const evidence = Array.from({ length: 10 }, (_, index) => makeEvidence(index, 0.8, index < 8))
    const summary = calculateCalibrationSummary(evidence, undefined, relaxedMinimums)
    expect(summary.expectedCalibrationError).toBeCloseTo(0)
    expect(summary.quality).toBe('good')
  })

  it('exposes overconfidence and underconfidence as signed gaps', () => {
    const overconfident = Array.from({ length: 10 }, (_, index) => makeEvidence(index, 0.9, index < 5))
    const underconfident = Array.from({ length: 10 }, (_, index) => makeEvidence(index + 20, 0.4, index < 8))
    expect(calculateCalibrationSummary(overconfident, undefined, relaxedMinimums).buckets[9]?.calibrationGap).toBeCloseTo(0.4)
    expect(calculateCalibrationSummary(underconfident, undefined, relaxedMinimums).buckets[4]?.calibrationGap).toBeCloseTo(-0.4)
  })

  it('marks zero and small samples as insufficient without fabricating rates', () => {
    const empty = calculateCalibrationSummary([])
    expect(empty).toMatchObject({ sampleCount: 0, expectedCalibrationError: null, quality: 'insufficient' })
    expect(calculateCalibrationSummary([makeEvidence(1, 0.8, true)]).quality).toBe('insufficient')
  })

  it('handles mixed buckets and outliers deterministically', () => {
    const evidence = [makeEvidence(1, 0.2, true), makeEvidence(2, 0.8, false), makeEvidence(3, 0.8, true)]
    const first = calculateCalibrationSummary(evidence, undefined, relaxedMinimums)
    expect(first).toEqual(calculateCalibrationSummary(evidence, undefined, relaxedMinimums))
    expect(first.buckets.filter(bucket => bucket.sampleCount)).toHaveLength(2)
    expect(first.buckets[8]?.meanRelativeError).toBeGreaterThan(0)
  })

  it('rejects invalid confidence and invalid measurement values', () => {
    expect(() => calculateCalibrationBucket(1.01)).toThrow(/between 0 and 1/)
    expect(() => suggestCalibratedConfidence(Number.NaN, [])).toThrow(/between 0 and 1/)
    expect(() => recordEvidence({
      ...makeEvidence(1, 0.8, true),
      estimatedValue: -1
    })).toThrow(/positive/)
  })
})

describe('calibrated confidence fallback', () => {
  it('prefers exact context when enough comparable evidence exists', () => {
    const evidence = Array.from({ length: 12 }, (_, index) => makeEvidence(index, 0.74, index < 8))
    const result = suggestCalibratedConfidence(0.71, evidence, {
      measurementType: 'height', modelVersion: 'v1', captureMethod: 'camera', deviceFamily: 'phone', roomCategory: 'living-area'
    })
    expect(result).toMatchObject({ applied: true, scope: 'exact_context', sampleCount: 12 })
    expect(result.calibratedConfidence).toBeCloseTo(8 / 12)
  })

  it('falls back from exact context to measurement type', () => {
    const evidence = Array.from({ length: 12 }, (_, index) => makeEvidence(index, 0.74, index < 9, { deviceFamily: 'other' }))
    const result = suggestCalibratedConfidence(0.71, evidence, { measurementType: 'height', deviceFamily: 'phone' })
    expect(result.scope).toBe('measurement_type')
  })

  it('falls back to global evidence and finally to unchanged raw confidence', () => {
    const evidence = Array.from({ length: 20 }, (_, index) => makeEvidence(index, 0.74, index < 10, { measurementType: 'width' }))
    expect(suggestCalibratedConfidence(0.71, evidence, { measurementType: 'height' }).scope).toBe('global')
    expect(suggestCalibratedConfidence(0.71, [], { measurementType: 'height' })).toMatchObject({
      applied: false,
      scope: 'raw_fallback',
      calibratedConfidence: 0.71,
      sampleCount: 0
    })
  })
})
