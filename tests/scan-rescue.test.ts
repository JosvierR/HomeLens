import { describe, expect, it } from 'vitest'
import { calculateHomeLensAnalysis } from '../shared/analysis'
import type { CalibratedConfidenceSuggestion } from '../shared/calibration'
import type { DecisionRoomScan } from '../shared/decision-confidence'
import { calculateDecisionConfidence } from '../shared/decision-confidence'
import { findBestRescueAction } from '../shared/scan-rescue'

const unstableScan: DecisionRoomScan = {
  id: 'rescue-room', roomName: 'Living Room', createdAt: '2026-09-02T00:00:00.000Z', windows: 3, doors: 0,
  measurements: [
    { id: 'width', label: 'Width', value: 14.2, unit: 'ft', confidence: 0.94, source: 'estimated' },
    { id: 'length', label: 'Length', value: 18.6, unit: 'ft', confidence: 0.88, source: 'estimated' },
    { id: 'height', label: 'Ceiling height', value: 9.1, unit: 'ft', confidence: 0.71, source: 'estimated' }
  ]
}

const calibrated = (rawConfidence: number, calibratedConfidence: number): CalibratedConfidenceSuggestion => ({
  rawConfidence,
  calibratedConfidence,
  applied: true,
  scope: 'exact_context',
  sampleCount: 30,
  quality: 'moderate',
  demoEvidence: true,
  reason: 'Test evidence.'
})

describe('findBestRescueAction', () => {
  it('does not request human work for an already stable decision', () => {
    const stable = structuredClone(unstableScan)
    stable.measurements.forEach(measurement => { measurement.confidence = 1; measurement.source = 'manual' })
    expect(findBestRescueAction(stable)).toMatchObject({ status: 'stable', actions: [], currentStability: 1 })
  })

  it('returns the best single next action with a transparent projected gain', () => {
    const action = findBestRescueAction(unstableScan)
    expect(action.status).toBe('needs_verification')
    expect(action.actions[0]).toMatchObject({ measurementId: action.measurementId, currentStability: action.currentStability })
    expect(action.actions[0]!.projectedStability).toBeGreaterThan(action.currentStability)
    expect(action.actions[0]!.stabilityGain).toBeCloseTo(action.actions[0]!.projectedStability - action.currentStability)
  })

  it('plans additional actions when one verification cannot reach a strict target', () => {
    const veryUncertain = structuredClone(unstableScan)
    veryUncertain.measurements.forEach(measurement => { measurement.confidence = 0.2 })
    const action = findBestRescueAction(veryUncertain, 1)
    expect(action.actions.length).toBeGreaterThan(1)
    expect(action.actions.at(-1)!.projectedStability).toBe(1)
  })

  it('removes manually verified measurements from rescue candidates', () => {
    const partiallyVerified = structuredClone(unstableScan)
    partiallyVerified.measurements[2]!.confidence = 1
    partiallyVerified.measurements[2]!.source = 'manual'
    const action = findBestRescueAction(partiallyVerified, 1)
    expect(action.actions.map(item => item.measurementId)).not.toContain('height')
  })

  it('can change ranking when sufficient calibration evidence changes effective reliability', () => {
    const raw = findBestRescueAction(unstableScan)
    const adjusted = findBestRescueAction(unstableScan, 0.9, {
      calibration: {
        width: calibrated(0.94, 0.2),
        length: calibrated(0.88, 0.99),
        height: calibrated(0.71, 0.99)
      }
    })
    expect(raw.measurementId).not.toBe('width')
    expect(adjusted.measurementId).toBe('width')
    expect(adjusted.actions[0]).toMatchObject({ calibrationApplied: true, calibrationSampleCount: 30 })
  })

  it('falls back safely to raw confidence when no evidence exists', () => {
    const rawDecision = calculateDecisionConfidence(unstableScan)
    const analysis = calculateHomeLensAnalysis(unstableScan, [])
    expect(analysis.calibration.status).toBe('raw_fallback')
    expect(analysis.decision).toEqual(rawDecision)
  })

  it('isolates calibration failures from basic decision analysis', () => {
    const invalidEvidence = [{ id: 'broken' }] as unknown as Parameters<typeof calculateHomeLensAnalysis>[1]
    const analysis = calculateHomeLensAnalysis(unstableScan, invalidEvidence)
    expect(analysis.calibration.status).toBe('raw_fallback')
    expect(analysis.decision).toEqual(calculateDecisionConfidence(unstableScan))
  })
})
