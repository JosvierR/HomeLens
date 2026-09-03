import { describe, expect, it } from 'vitest'
import type { DecisionRoomScan } from '../shared/decision-confidence'
import { applyManualVerification } from '../shared/verification'

const scan: DecisionRoomScan = {
  id: 'scan', roomName: 'Room', createdAt: '2026-09-02T12:00:00.000Z', windows: 0, doors: 0,
  measurements: [
    { id: 'width', label: 'Width', value: 14, unit: 'ft', confidence: 0.9, source: 'estimated' },
    { id: 'length', label: 'Length', value: 18, unit: 'ft', confidence: 0.8, source: 'estimated' },
    { id: 'height', label: 'Height', value: 9.1, unit: 'ft', confidence: 0.71, source: 'estimated' }
  ]
}

describe('manual verification provenance', () => {
  it('preserves the original estimate while accepting a human value', () => {
    const verified = applyManualVerification(scan, 'height', 9, '2026-09-02T13:00:00.000Z')
    const height = verified.measurements.find(item => item.id === 'height')!
    expect(height).toMatchObject({
      value: 9,
      confidence: 1,
      source: 'manual',
      rawConfidence: 0.71,
      originalEstimate: { value: 9.1, confidence: 0.71 },
      verification: { verificationSource: 'manual', previousValue: 9.1, previousConfidence: 0.71 }
    })
    expect(scan.measurements.find(item => item.id === 'height')?.value).toBe(9.1)
  })

  it('rejects unknown ids and invalid values', () => {
    expect(() => applyManualVerification(scan, 'unknown', 9, '2026-09-02T13:00:00.000Z')).toThrow(/Unknown measurement/)
    expect(() => applyManualVerification(scan, 'height', 0, '2026-09-02T13:00:00.000Z')).toThrow()
    expect(() => applyManualVerification(scan, 'height', Number.POSITIVE_INFINITY, '2026-09-02T13:00:00.000Z')).toThrow()
  })
})
