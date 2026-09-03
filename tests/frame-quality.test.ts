import { describe, expect, it } from 'vitest'
import { assessFrameQuality } from '../shared/frame-quality'

describe('frame quality heuristics', () => {
  it('flags dark frames', () => {
    const result = assessFrameQuality({ width: 1280, height: 720, brightness: 20, sharpness: 40 })
    expect(result.bucket).toBe('recapture_recommended')
    expect(result.reason).toBe('Too dark')
  })

  it('accepts a usable well-lit sharp frame', () => {
    const result = assessFrameQuality({ width: 1280, height: 720, brightness: 120, sharpness: 40 })
    expect(result.bucket).toBe('good')
    expect(result.reason).toBeNull()
  })
})
