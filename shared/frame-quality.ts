/**
 * Transparent local frame quality heuristics — not computer vision measurements.
 */

export type FrameQualityBucket = 'good' | 'usable' | 'recapture_recommended'

export interface FrameQualityInput {
  width: number
  height: number
  /** Mean luma 0..255 from sampled pixels */
  brightness: number
  /** Approximate Laplacian variance / blur proxy */
  sharpness: number
}

export interface FrameQualityResult {
  bucket: FrameQualityBucket
  brightnessScore: number
  sharpnessScore: number
  reason: string | null
}

const MIN_EDGE = 480
const DARK = 40
const BRIGHT = 220
const BLURRY = 12

export const assessFrameQuality = (input: FrameQualityInput): FrameQualityResult => {
  const brightnessScore = Math.min(1, Math.max(0, input.brightness / 255))
  const sharpnessScore = Math.min(1, Math.max(0, input.sharpness / 100))
  const minEdge = Math.min(input.width, input.height)

  if (minEdge < MIN_EDGE) {
    return {
      bucket: 'recapture_recommended',
      brightnessScore,
      sharpnessScore,
      reason: 'Resolution too low'
    }
  }
  if (input.brightness < DARK) {
    return {
      bucket: 'recapture_recommended',
      brightnessScore,
      sharpnessScore,
      reason: 'Too dark'
    }
  }
  if (input.brightness > BRIGHT) {
    return {
      bucket: 'recapture_recommended',
      brightnessScore,
      sharpnessScore,
      reason: 'Too bright'
    }
  }
  if (input.sharpness < BLURRY) {
    return {
      bucket: 'recapture_recommended',
      brightnessScore,
      sharpnessScore,
      reason: 'Too blurry'
    }
  }
  if (input.sharpness < BLURRY * 2 || brightnessScore < 0.25 || brightnessScore > 0.9) {
    return {
      bucket: 'usable',
      brightnessScore,
      sharpnessScore,
      reason: null
    }
  }
  return {
    bucket: 'good',
    brightnessScore,
    sharpnessScore,
    reason: null
  }
}
