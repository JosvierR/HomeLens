import { describe, expect, it } from 'vitest'
import { assessFrameQuality } from '../shared/frame-quality'

describe('frame quality heuristics', () => {
  it('flags dark frames', () => {
    const result = assessFrameQuality({ width: 1280, height: 720, brightness: 20, sharpness: 40 })
    expect(result.bucket).toBe('recapture_recommended')
    expect(result.reason).toBe('Too dark')
  })

  it('accepts a usable well-lit sharp frame', () => {
    const result = assessFrameQuality({ width: 1280, height: 720, brightness: 120, sharpness: 40, contrast: 35 })
    expect(result.bucket).toBe('good')
    expect(result.reason).toBeNull()
  })

  it('rejects a flat frame even when its average brightness is acceptable', () => {
    const result = assessFrameQuality({ width: 1280, height: 720, brightness: 120, sharpness: 40, contrast: 4 })
    expect(result.bucket).toBe('recapture_recommended')
    expect(result.reason).toBe('Not enough visible detail')
  })

  it('rejects a severely blurred frame without rejecting normal flat wall areas', () => {
    const result = assessFrameQuality({ width: 1280, height: 720, brightness: 120, sharpness: 0.5, contrast: 35 })
    expect(result.bucket).toBe('recapture_recommended')
    expect(result.reason).toBe('Too blurry')
  })
})
