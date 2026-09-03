import { describe, expect, it } from 'vitest'
import type { DecisionRoomScan } from '../shared/decision-confidence'
import { recommendScanRescue } from '../shared/scan-rescue'

const unstableScan: DecisionRoomScan = {
  id: 'rescue-room', roomName: 'Living Room', createdAt: '2026-09-02T00:00:00.000Z', windows: 4, doors: 2,
  measurements: [
    { id: 'width', label: 'Width', value: 15.8, unit: 'ft', confidence: 0.72, source: 'estimated' },
    { id: 'length', label: 'Length', value: 18.8, unit: 'ft', confidence: 0.7, source: 'estimated' },
    { id: 'height', label: 'Ceiling height', value: 9.4, unit: 'ft', confidence: 0.62, source: 'estimated' }
  ]
}

describe('recommendScanRescue', () => {
  it('recommends at most one next verification action', () => {
    const action = recommendScanRescue(unstableScan, 0.99)
    expect(['stable', 'needs_verification']).toContain(action.status)
    if (action.status === 'needs_verification') {
      expect(action.measurementId).toBeTruthy()
      expect(action.projectedStability).toBeGreaterThanOrEqual(action.currentStability)
    }
  })
})
