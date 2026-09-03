import { describe, expect, it } from 'vitest'
import {
  calculateCalibrationSummary,
  evidenceOriginOf,
  filterProductionEvidence,
  recordEvidence,
  suggestCalibratedConfidence
} from '../shared/calibration'
import type { MeasurementEvidence } from '../shared/calibration'
import { calculateHomeLensAnalysis } from '../shared/analysis'
import { createUncertainFitDemoScan } from '../shared/demo-fixtures'
import { demoEvidence } from '../server/data/demo-evidence'

const series = (count: number, demo: boolean, prefix: string): MeasurementEvidence[] =>
  Array.from({ length: count }, (_, index) => recordEvidence({
    id: `${prefix}-${index + 1}`,
    scanId: `${prefix}-scan-${index + 1}`,
    roomId: `${prefix}-room-${index + 1}`,
    measurementId: 'width',
    measurementType: 'width',
    estimatedValue: 12,
    estimatedConfidence: 0.77,
    verifiedValue: index % 4 === 0 ? 12.9 : 12.1,
    verificationSource: 'manual',
    decisionStabilityBefore: 0.7,
    decisionStabilityAfter: 0.9,
    createdAt: '2026-06-01T12:00:00.000Z',
    demo
  }))

describe('real versus synthetic evidence', () => {
  it('keeps the shipped demo history flagged as synthetic', () => {
    expect(demoEvidence.length).toBeGreaterThan(0)
    expect(demoEvidence.every(item => item.demo)).toBe(true)
    expect(evidenceOriginOf(demoEvidence)).toBe('synthetic_demo')
    expect(filterProductionEvidence(demoEvidence)).toHaveLength(0)
  })

  it('counts production and synthetic samples separately in the summary', () => {
    const summary = calculateCalibrationSummary([...series(20, true, 'demo'), ...series(6, false, 'real')])

    expect(summary.sampleCount).toBe(26)
    expect(summary.demoEvidenceCount).toBe(20)
    expect(summary.productionEvidenceCount).toBe(6)
    expect(summary.origin).toBe('mixed')
  })

  it('labels a suggestion built from synthetic history as a preview', () => {
    const suggestion = suggestCalibratedConfidence(0.77, series(24, true, 'demo'), { measurementType: 'width' })

    expect(suggestion.applied).toBe(true)
    expect(suggestion.demoEvidence).toBe(true)
    expect(suggestion.syntheticSampleCount).toBe(24)
    expect(suggestion.productionSampleCount).toBe(0)
    expect(suggestion.reason).toContain('synthetic comparison samples')
    expect(suggestion.reason).not.toContain('comparable verified measurements')
  })

  it('refuses to adjust confidence from real history alone until the minimum is met', () => {
    const production = series(8, false, 'real')
    const suggestion = suggestCalibratedConfidence(0.77, filterProductionEvidence(production), { measurementType: 'width' })

    expect(suggestion.applied).toBe(false)
    expect(suggestion.scope).toBe('raw_fallback')
    expect(suggestion.calibratedConfidence).toBe(suggestion.rawConfidence)
    expect(suggestion.reason).toContain('Not enough real verified history yet')
  })

  it('only claims historical calibration once real evidence carries it', () => {
    const suggestion = suggestCalibratedConfidence(0.77, series(24, false, 'real'), { measurementType: 'width' })

    expect(suggestion.demoEvidence).toBe(false)
    expect(suggestion.productionSampleCount).toBe(24)
    expect(suggestion.reason).toContain('comparable verified measurements')
  })

  it('never mixes synthetic samples into a production adjustment', () => {
    const mixed = [...series(24, true, 'demo'), ...series(8, false, 'real')]
    const suggestion = suggestCalibratedConfidence(0.77, mixed, { measurementType: 'width' })

    expect(suggestion.applied).toBe(true)
    expect(suggestion.demoEvidence).toBe(true)
    expect(suggestion.productionSampleCount).toBe(0)
    expect(suggestion.syntheticSampleCount).toBe(24)
    expect(suggestion.reason).toContain('synthetic comparison samples')
  })

  it('prefers real history once it meets the minimum, even if synthetic history exists', () => {
    const mixed = [...series(24, true, 'demo'), ...series(24, false, 'real')]
    const suggestion = suggestCalibratedConfidence(0.77, mixed, { measurementType: 'width' })

    expect(suggestion.demoEvidence).toBe(false)
    expect(suggestion.productionSampleCount).toBe(24)
    expect(suggestion.syntheticSampleCount).toBe(0)
    expect(suggestion.reason).toContain('comparable verified measurements')
  })

  it('reports the calibration origin through the analysis contract', () => {
    const scan = createUncertainFitDemoScan()

    expect(calculateHomeLensAnalysis(scan, demoEvidence).calibration.origin).toBe('synthetic_demo')
    expect(calculateHomeLensAnalysis(scan, []).calibration.origin).toBe('none')
    expect(calculateHomeLensAnalysis(scan, filterProductionEvidence(demoEvidence)).calibration.status).toBe('raw_fallback')
  })
})
