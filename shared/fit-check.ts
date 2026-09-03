import type { DecisionMeasurement, DecisionRoomScan } from './decision-confidence'
import { measurementUncertaintyBounds } from './decision-confidence'

export const FIT_CHECK_MODEL_VERSION = 'fit-check-v1' as const

/** Half-width of a 90% interval expressed in standard deviations. */
const NINETY_PERCENT_Z = 1.6448536269514722
const FITS_THRESHOLD = 0.9
const TIGHT_THRESHOLD = 0.5

export type FitDimensionId = 'width' | 'length' | 'height'
export type FitVerdict = 'fits' | 'tight' | 'does_not_fit' | 'unsupported'
export type FitOrientation = 'long_along_width' | 'long_along_length'

export interface FitItem {
  id: string
  label: string
  category: 'sleeping' | 'living' | 'dining' | 'work' | 'utility'
  /** Object footprint in feet, without any access space. */
  longSideFeet: number
  shortSideFeet: number
  /** Access space required along the short side: walkway, chair pull-out, or appliance door swing. */
  clearanceFeet: number
  /** Ceiling height the item needs, when it is height sensitive. */
  minCeilingFeet?: number
  rationale: string
}

export interface FitDimensionCheck {
  measurementId: FitDimensionId
  label: string
  requiredFeet: number
  availableFeet: number
  marginFeet: number
  probability: number
  verified: boolean
}

export interface FitCheckResult {
  item: FitItem
  verdict: FitVerdict
  probability: number
  marginFeet: number
  orientation: FitOrientation
  checks: FitDimensionCheck[]
  limiting: FitDimensionCheck | null
  /** The one measurement worth taping to turn a probable answer into a definitive one. */
  nextVerification: { measurementId: FitDimensionId, label: string, probabilityIfConfirmed: number } | null
  summary: string
  modelVersion: typeof FIT_CHECK_MODEL_VERSION
}

/**
 * Footprints use common US retail sizes; clearances follow standard residential
 * circulation guidance (about 3 ft for walkways and chair pull-out, 2 ft for bed access).
 */
export const FIT_CATALOG: readonly FitItem[] = [
  {
    id: 'queen_bed',
    label: 'Queen bed',
    category: 'sleeping',
    longSideFeet: 6.67,
    shortSideFeet: 5,
    clearanceFeet: 2,
    rationale: '60 x 80 in mattress with a 2 ft walkway on one side.'
  },
  {
    id: 'king_bed',
    label: 'King bed',
    category: 'sleeping',
    longSideFeet: 6.67,
    shortSideFeet: 6.33,
    clearanceFeet: 2,
    rationale: '76 x 80 in mattress with a 2 ft walkway on one side.'
  },
  {
    id: 'bunk_bed',
    label: 'Bunk bed',
    category: 'sleeping',
    longSideFeet: 6.67,
    shortSideFeet: 3.5,
    clearanceFeet: 2,
    minCeilingFeet: 7.5,
    rationale: 'Twin bunk footprint plus the ceiling height needed for the top bunk.'
  },
  {
    id: 'three_seat_sofa',
    label: '3-seat sofa',
    category: 'living',
    longSideFeet: 7,
    shortSideFeet: 3,
    clearanceFeet: 2.5,
    rationale: '84 in sofa with a 2.5 ft walkway in front.'
  },
  {
    id: 'sectional_sofa',
    label: 'L-shaped sectional',
    category: 'living',
    longSideFeet: 9,
    shortSideFeet: 6.5,
    clearanceFeet: 2.5,
    rationale: 'Typical 108 x 78 in sectional with a 2.5 ft walkway.'
  },
  {
    id: 'dining_table_six',
    label: 'Dining table for 6',
    category: 'dining',
    longSideFeet: 6,
    shortSideFeet: 3,
    clearanceFeet: 6,
    rationale: '72 x 36 in table with 3 ft of chair pull-out on both long sides.'
  },
  {
    id: 'work_desk',
    label: 'Home office desk',
    category: 'work',
    longSideFeet: 5,
    shortSideFeet: 2.5,
    clearanceFeet: 3,
    rationale: '60 in desk with 3 ft for the chair.'
  },
  {
    id: 'laundry_pair',
    label: 'Washer and dryer',
    category: 'utility',
    longSideFeet: 5.2,
    shortSideFeet: 2.6,
    clearanceFeet: 3,
    rationale: 'Side-by-side units with 3 ft for the door swing.'
  }
]

/** Abramowitz and Stegun 7.1.26; absolute error stays under 1.5e-7. */
const erf = (value: number) => {
  const sign = value < 0 ? -1 : 1
  const x = Math.abs(value)
  const t = 1 / (1 + 0.3275911 * x)
  const series = t * (0.254829592
    + t * (-0.284496736
      + t * (1.421413741
        + t * (-1.453152027 + t * 1.061405429))))
  return sign * (1 - series * Math.exp(-x * x))
}

const normalCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2))

const standardDeviationFeet = (measurement: DecisionMeasurement) => {
  if (measurement.source === 'manual') return 0
  const bounds = measurementUncertaintyBounds(measurement)
  return Math.max(0, (bounds.high - bounds.low) / (2 * NINETY_PERCENT_Z))
}

const probabilityAtLeast = (measurement: DecisionMeasurement, requiredFeet: number) => {
  const sigma = standardDeviationFeet(measurement)
  if (sigma <= 0) return measurement.value >= requiredFeet ? 1 : 0
  return normalCdf((measurement.value - requiredFeet) / sigma)
}

const buildCheck = (
  measurement: DecisionMeasurement,
  measurementId: FitDimensionId,
  requiredFeet: number
): FitDimensionCheck => ({
  measurementId,
  label: measurement.label,
  requiredFeet,
  availableFeet: measurement.value,
  marginFeet: measurement.value - requiredFeet,
  probability: probabilityAtLeast(measurement, requiredFeet),
  verified: measurement.source === 'manual'
})

const verdictFor = (probability: number): FitVerdict => {
  if (probability >= FITS_THRESHOLD) return 'fits'
  if (probability >= TIGHT_THRESHOLD) return 'tight'
  return 'does_not_fit'
}

const feet = (value: number) => `${value.toFixed(1)} ft`

const summarize = (item: FitItem, verdict: FitVerdict, probability: number, limiting: FitDimensionCheck | null) => {
  if (verdict === 'unsupported') return `${item.label} cannot be checked without width, length, and ceiling height.`
  const chance = `${Math.round(probability * 100)}% of the measured range`
  if (!limiting) return `${item.label} fits in ${chance}.`
  const shortfall = Math.abs(limiting.marginFeet)
  if (verdict === 'does_not_fit') {
    return `${item.label} needs ${feet(limiting.requiredFeet)} of ${limiting.label.toLowerCase()} and the room measures ${feet(limiting.availableFeet)}, short by ${feet(shortfall)}.`
  }
  if (verdict === 'tight') {
    return `${item.label} only clears ${limiting.label.toLowerCase()} by ${feet(limiting.marginFeet)}, so it fits in ${chance}.`
  }
  return `${item.label} fits in ${chance} with ${feet(limiting.marginFeet)} to spare on ${limiting.label.toLowerCase()}.`
}

const orientationResult = (
  item: FitItem,
  width: DecisionMeasurement,
  length: DecisionMeasurement,
  height: DecisionMeasurement | undefined,
  orientation: FitOrientation
) => {
  const longRequired = item.longSideFeet
  const shortRequired = item.shortSideFeet + item.clearanceFeet
  const checks: FitDimensionCheck[] = orientation === 'long_along_width'
    ? [buildCheck(width, 'width', longRequired), buildCheck(length, 'length', shortRequired)]
    : [buildCheck(width, 'width', shortRequired), buildCheck(length, 'length', longRequired)]

  if (item.minCeilingFeet !== undefined && height) {
    checks.push(buildCheck(height, 'height', item.minCeilingFeet))
  }

  const probability = checks.reduce((total, check) => total * check.probability, 1)
  return { orientation, checks, probability }
}

/**
 * Answer "does this actually fit?" against the measured room instead of a single
 * point estimate. Each dimension is treated as a normal distribution derived from
 * its uncertainty interval, so the result is a probability over the measured range.
 * Dimensions are combined as independent, which is the honest reading of
 * separately fused per-dimension observations.
 */
export const evaluateItemFit = (scan: DecisionRoomScan, item: FitItem): FitCheckResult => {
  const width = scan.measurements.find(measurement => measurement.id === 'width')
  const length = scan.measurements.find(measurement => measurement.id === 'length')
  const height = scan.measurements.find(measurement => measurement.id === 'height')

  if (!width || !length || (item.minCeilingFeet !== undefined && !height)) {
    return {
      item,
      verdict: 'unsupported',
      probability: 0,
      marginFeet: 0,
      orientation: 'long_along_width',
      checks: [],
      limiting: null,
      nextVerification: null,
      summary: summarize(item, 'unsupported', 0, null),
      modelVersion: FIT_CHECK_MODEL_VERSION
    }
  }

  const candidates = [
    orientationResult(item, width, length, height, 'long_along_width'),
    orientationResult(item, width, length, height, 'long_along_length')
  ]
  const best = candidates.reduce((winner, candidate) => candidate.probability > winner.probability ? candidate : winner)

  const limiting = best.checks.reduce<FitDimensionCheck | null>((worst, check) =>
    !worst || check.probability < worst.probability ? check : worst, null)
  const verdict = verdictFor(best.probability)

  const unresolved = best.checks.filter(check => !check.verified && check.probability < 0.999)
  const target = unresolved.reduce<FitDimensionCheck | null>((worst, check) =>
    !worst || check.probability < worst.probability ? check : worst, null)
  const probabilityIfConfirmed = target
    ? best.checks.reduce((total, check) =>
      check.measurementId === target.measurementId
        ? total * (check.marginFeet >= 0 ? 1 : 0)
        : total * check.probability, 1)
    : 0

  return {
    item,
    verdict,
    probability: best.probability,
    marginFeet: best.checks.reduce((smallest, check) => Math.min(smallest, check.marginFeet), Number.POSITIVE_INFINITY),
    orientation: best.orientation,
    checks: best.checks,
    limiting,
    nextVerification: target
      ? { measurementId: target.measurementId, label: target.label, probabilityIfConfirmed }
      : null,
    summary: summarize(item, verdict, best.probability, limiting),
    modelVersion: FIT_CHECK_MODEL_VERSION
  }
}

export const evaluateRoomFit = (
  scan: DecisionRoomScan,
  items: readonly FitItem[] = FIT_CATALOG
): FitCheckResult[] => items
  .map(item => evaluateItemFit(scan, item))
  .sort((a, b) => b.probability - a.probability || a.item.id.localeCompare(b.item.id))

export interface FitCheckSummary {
  fits: number
  tight: number
  doesNotFit: number
  /** The measurement that would resolve the most undecided items if it were taped. */
  decidingMeasurementId: FitDimensionId | null
  headline: string
}

export const summarizeRoomFit = (results: readonly FitCheckResult[]): FitCheckSummary => {
  const fits = results.filter(result => result.verdict === 'fits').length
  const tight = results.filter(result => result.verdict === 'tight').length
  const doesNotFit = results.filter(result => result.verdict === 'does_not_fit').length

  const undecidedCounts = new Map<FitDimensionId, number>()
  results
    .filter(result => result.verdict === 'tight')
    .forEach(result => {
      const id = result.nextVerification?.measurementId
      if (id) undecidedCounts.set(id, (undecidedCounts.get(id) ?? 0) + 1)
    })
  const deciding = [...undecidedCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]

  return {
    fits,
    tight,
    doesNotFit,
    decidingMeasurementId: deciding?.[0] ?? null,
    headline: tight
      ? `${fits} of ${results.length} items clear the room; ${tight} depend on measurement uncertainty.`
      : `${fits} of ${results.length} items clear the room with the current measurements.`
  }
}
