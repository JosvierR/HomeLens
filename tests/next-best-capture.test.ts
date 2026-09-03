import { describe, expect, it } from 'vitest'
import { recommendNextBestCapture } from '../shared/next-best-capture'
import { recommendScanRescue } from '../shared/scan-rescue'
import { createDemoScanFixture } from './helpers/demo-scan'

describe('next best capture', () => {
  it('returns a capture action or stop with inspectable utility fields', () => {
    const scan = createDemoScanFixture()
    const rescue = recommendScanRescue(scan)
    const next = recommendNextBestCapture(scan, rescue)
    expect(next.policyVersion).toBeTruthy()
    expect(next.currentStability).toBeGreaterThanOrEqual(0)
    if (next.kind === 'capture') {
      expect(next.utilityScore).toBeGreaterThan(0)
      expect(next.instruction.length).toBeGreaterThan(0)
    } else {
      expect(next.kind).toBe('stop')
    }
  })

  it('stops when existing targets exhaust useful actions', () => {
    const scan = createDemoScanFixture()
    const rescue = recommendScanRescue(scan)
    const next = recommendNextBestCapture(scan, rescue, {
      existingTargets: ['room_overview', 'opposite_corner', 'ceiling_edge', 'ceiling_corner', 'far_wall', 'opening_edge'],
      minUsefulGain: 1
    })
    expect(next.kind).toBe('stop')
  })
})
