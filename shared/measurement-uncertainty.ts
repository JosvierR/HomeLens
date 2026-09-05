/**
 * One mapping between photo-metric uncertainty and displayed confidence.
 *
 * The 90% interval is the primary quantity. Confidence is the inverse of that
 * interval's relative half-width, so a tight range can never show as low
 * confidence and a wide range can never show as near-certain.
 *
 * Inverse pair:
 *   relativeHalf = (1 - confidence) * MAX_RELATIVE_HALF_WIDTH
 *   confidence   = 1 - relativeHalf / MAX_RELATIVE_HALF_WIDTH
 */

export const MAX_RELATIVE_HALF_WIDTH = 0.29
export const MIN_HALF_WIDTH_FEET = 0.08
export const MIN_DIMENSION_FEET = 0.1
export const MAX_DIMENSION_FEET = 100
/** Half-width of a 90% interval expressed in standard deviations. */
export const NINETY_PERCENT_Z = 1.6448536269514722

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const assertPositiveFinite = (value: number, name: string) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite positive number.`)
  }
}

export const clampConfidence = (value: number) => {
  if (!Number.isFinite(value)) throw new Error('Confidence must be a finite number.')
  return clamp01(value)
}

/** Relative half-width implied by a confidence score. */
export const relativeHalfWidthFromConfidence = (confidence: number) =>
  (1 - clampConfidence(confidence)) * MAX_RELATIVE_HALF_WIDTH

/** Confidence implied by a 90% half-width around `valueFeet`. */
export const confidenceFromHalfWidth = (valueFeet: number, halfWidthFeet: number) => {
  assertPositiveFinite(valueFeet, 'Value')
  if (!Number.isFinite(halfWidthFeet) || halfWidthFeet < 0) {
    throw new Error('Half-width must be a finite non-negative number.')
  }
  return clampConfidence(1 - (halfWidthFeet / valueFeet) / MAX_RELATIVE_HALF_WIDTH)
}

export const halfWidthFromConfidence = (valueFeet: number, confidence: number) => {
  assertPositiveFinite(valueFeet, 'Value')
  return valueFeet * relativeHalfWidthFromConfidence(confidence)
}

export const boundsFromConfidence = (valueFeet: number, confidence: number) => {
  const half = halfWidthFromConfidence(valueFeet, confidence)
  return {
    low: Math.max(MIN_DIMENSION_FEET, valueFeet - half),
    high: Math.min(MAX_DIMENSION_FEET, valueFeet + half)
  }
}

export const boundsFromHalfWidth = (valueFeet: number, halfWidthFeet: number) => ({
  low: Math.max(MIN_DIMENSION_FEET, valueFeet - halfWidthFeet),
  high: Math.min(MAX_DIMENSION_FEET, valueFeet + halfWidthFeet)
})

const mean = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0) / Math.max(1, values.length)

export interface FusedUncertaintyInput {
  valueFeet: number
  observationValues: readonly number[]
  observationHalfWidths: readonly number[]
}

export interface FusedUncertainty {
  halfWidthFeet: number
  confidence: number
  uncertaintyLowFeet: number
  uncertaintyHighFeet: number
}

/**
 * Fuse per-view intervals into one 90% range, then read confidence from it.
 *
 * - Within-view noise shrinks modestly when several views agree (errors are
 *   correlated, so we never shrink below 70% of the typical per-view half-width).
 * - Disagreement between views is a 90% interval on the sample spread.
 * - Signal quality belongs in the per-view interval (the worker), not as a
 *   second confidence score that can contradict the range.
 */
export const fuseUncertainty = ({
  valueFeet,
  observationValues,
  observationHalfWidths
}: FusedUncertaintyInput): FusedUncertainty => {
  assertPositiveFinite(valueFeet, 'Value')
  if (!observationValues.length || observationValues.length !== observationHalfWidths.length) {
    throw new Error('Each observation needs a value and a half-width.')
  }

  const viewCount = observationValues.length
  const withinHalf = mean(observationHalfWidths.map(width => Math.max(MIN_HALF_WIDTH_FEET, width)))
  const betweenSigma = viewCount > 1
    ? Math.sqrt(mean(observationValues.map(value => (value - valueFeet) ** 2)))
    : 0
  const viewShrink = Math.max(0.7, 1 / Math.sqrt(Math.min(viewCount, 3)))
  const halfWidthFeet = Math.max(
    MIN_HALF_WIDTH_FEET,
    withinHalf * viewShrink,
    betweenSigma * NINETY_PERCENT_Z
  )
  const bounds = boundsFromHalfWidth(valueFeet, halfWidthFeet)
  return {
    halfWidthFeet,
    confidence: confidenceFromHalfWidth(valueFeet, halfWidthFeet),
    uncertaintyLowFeet: bounds.low,
    uncertaintyHighFeet: bounds.high
  }
}
