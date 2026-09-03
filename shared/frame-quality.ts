/**
 * Transparent local frame quality heuristics — not computer vision measurements.
 */

export type FrameQualityBucket = 'good' | 'usable' | 'recapture_recommended'

export interface FrameQualityInput {
  width: number
  height: number
  /** Mean luma 0..255 from sampled pixels */
  brightness: number
  /** Mean local gradient / blur proxy */
  sharpness: number
  /** Luma standard deviation 0..127.5 */
  contrast?: number
  /** Fraction of sampled pixels with crushed shadows, 0..1 */
  shadowClipping?: number
  /** Fraction of sampled pixels with clipped highlights, 0..1 */
  highlightClipping?: number
}

export interface FrameQualityResult {
  bucket: FrameQualityBucket
  brightnessScore: number
  sharpnessScore: number
  contrastScore: number
  reason: string | null
}

const MIN_EDGE = 480
const DARK = 40
const BRIGHT = 220
// The gradient is averaged across the whole image; real rooms contain large,
// intentionally flat wall areas. Only reject near-zero detail and mark softer
// frames as usable so valid mobile cameras are not trapped in a retry loop.
const SEVERELY_BLURRY = 1.5
const SOFT = 6
const FLAT_CONTRAST = 10
const EXCESSIVE_CLIPPING = 0.72

export const assessFrameQuality = (input: FrameQualityInput): FrameQualityResult => {
  const brightnessScore = Math.min(1, Math.max(0, input.brightness / 255))
  const sharpnessScore = Math.min(1, Math.max(0, input.sharpness / 100))
  const contrastScore = Math.min(1, Math.max(0, (input.contrast ?? 32) / 64))
  const minEdge = Math.min(input.width, input.height)

  if (minEdge < MIN_EDGE) {
    return {
      bucket: 'recapture_recommended',
      brightnessScore,
      sharpnessScore,
      contrastScore,
      reason: 'Resolution too low'
    }
  }
  if (input.brightness < DARK) {
    return {
      bucket: 'recapture_recommended',
      brightnessScore,
      sharpnessScore,
      contrastScore,
      reason: 'Too dark'
    }
  }
  if (input.brightness > BRIGHT) {
    return {
      bucket: 'recapture_recommended',
      brightnessScore,
      sharpnessScore,
      contrastScore,
      reason: 'Too bright'
    }
  }
  if (input.sharpness < SEVERELY_BLURRY) {
    return {
      bucket: 'recapture_recommended',
      brightnessScore,
      sharpnessScore,
      contrastScore,
      reason: 'Too blurry'
    }
  }
  if ((input.contrast ?? 32) < FLAT_CONTRAST) {
    return {
      bucket: 'recapture_recommended',
      brightnessScore,
      sharpnessScore,
      contrastScore,
      reason: 'Not enough visible detail'
    }
  }
  if ((input.shadowClipping ?? 0) > EXCESSIVE_CLIPPING) {
    return {
      bucket: 'recapture_recommended',
      brightnessScore,
      sharpnessScore,
      contrastScore,
      reason: 'Most of the view is in shadow'
    }
  }
  if ((input.highlightClipping ?? 0) > EXCESSIVE_CLIPPING) {
    return {
      bucket: 'recapture_recommended',
      brightnessScore,
      sharpnessScore,
      contrastScore,
      reason: 'Most of the view is overexposed'
    }
  }
  if (input.sharpness < SOFT || brightnessScore < 0.25 || brightnessScore > 0.9) {
    return {
      bucket: 'usable',
      brightnessScore,
      sharpnessScore,
      contrastScore,
      reason: null
    }
  }
  return {
    bucket: 'good',
    brightnessScore,
    sharpnessScore,
    contrastScore,
    reason: null
  }
}
