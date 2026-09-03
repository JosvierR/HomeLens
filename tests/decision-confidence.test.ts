import { describe, expect, it } from 'vitest'
import { calculateDecisionConfidence, type DecisionRoomScan } from '../shared/decision-confidence'

const scan: DecisionRoomScan = {
  id: 'test-room', roomName: 'Living Room', createdAt: '2026-09-02T00:00:00.000Z', windows: 3, doors: 2,
  measurements: [
    { id: 'width', label: 'Width', value: 14.2, unit: 'ft', confidence: 0.94, source: 'estimated' },
    { id: 'length', label: 'Length', value: 18.6, unit: 'ft', confidence: 0.88, source: 'estimated' },
    { id: 'height', label: 'Ceiling height', value: 9.1, unit: 'ft', confidence: 0.71, source: 'estimated' }
  ]
}

describe('calculateDecisionConfidence', () => {
  it('returns a deterministic result', () => { expect(calculateDecisionConfidence(scan)).toEqual(calculateDecisionConfidence(scan)) })
  it('raises stability when a low-confidence measurement is manually verified', () => {
    const before = calculateDecisionConfidence(scan)
    const verified: DecisionRoomScan = structuredClone(scan)
    const height = verified.measurements.find(item => item.id === 'height')!
    height.confidence = 1; height.source = 'manual'
    const after = calculateDecisionConfidence(verified)
    expect(after.bandStability).toBeGreaterThanOrEqual(before.bandStability)
  })
  it('orders verification items by decision priority', () => {
    const result = calculateDecisionConfidence(scan)
    expect(result.verificationQueue).toHaveLength(3)
    expect(result.verificationQueue[0].priorityScore).toBeGreaterThanOrEqual(result.verificationQueue[1].priorityScore)
  })
})
