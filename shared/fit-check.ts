import type { DecisionMeasurement, DecisionRoomScan } from './decision-confidence'
import { measurementUncertaintyBounds } from './decision-confidence'
import { formatFeet, formatPercent } from './format'

export const FIT_CHECK_MODEL_VERSION = 'fit-check-v1' as const

/** Half-width of a 90% interval expressed in standard deviations. */
const NINETY_PERCENT_Z = 1.6448536269514722
const FITS_THRESHOLD = 0.9
const UNCERTAIN_THRESHOLD = 0.5
const IMPACT_EPSILON = 1e-6

export type FitDimensionId = 'width' | 'length' | 'height'
export type FitVerdict = 'fits' | 'uncertain' | 'does_not_fit' | 'unsupported'
export type FitOrientation = 'long_along_width' | 'long_along_length'
export type FitCertainty = 'verified' | 'estimated'

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
  /** Footprint plus the access space this dimension has to absorb. */
  requiredFeet: number
  availableFeet: number
  /** Available minus required. Negative means the item is short of space. */
  marginFeet: number
  probability: number
  verified: boolean
}

export interface FitCriticalMeasurement {
  measurementId: FitDimensionId
  label: string
  /** Expected movement in the fit answer if this dimension were taped. */
  decisionImpact: number
  /** Fit probability if the tape confirms the current estimate. */
  probabilityIfConfirmed: number
}

export interface FitCheckResult {
  item: FitItem
  verdict: FitVerdict
  probability: number
  certainty: FitCertainty
  orientation: FitOrientation
  checks: FitDimensionCheck[]
  /**
   * The binding constraint: the dimension with the smallest remaining space
   * after the required walkway. Every clearance number shown in the UI comes
   * from this single check so the figure and the copy can never disagree.
   */
  clearance: FitDimensionCheck | null
  clearanceFeet: number | null
  criticalMeasurement: FitCriticalMeasurement | null
  summary: string
  modelVersion: typeof FIT_CHECK_MODEL_VERSION
}

/**
 * Footprints use common US retail sizes; clearances follow standard residential
 * circulation guidance (about 3 ft for walkways and chair pull-out, 2 ft for bed
 * access). These are planning assumptions, not building-code compliance.
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
    rationale: 'Twin bunk footprint plus clearance for the top bunk.'
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
    rationale: '108 x 78 in sectional with a 2.5 ft walkway in front.'
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
  if (probability >= UNCERTAIN_THRESHOLD) return 'uncertain'
  return 'does_not_fit'
}

const summarize = (
  verdict: FitVerdict,
  certainty: FitCertainty,
  probability: number,
  clearance: FitDimensionCheck | null
) => {
  if (verdict === 'unsupported' || !clearance) {
    return 'This item cannot be checked without width, length, and ceiling height.'
  }

  const dimension = clearance.label.toLowerCase()
  if (verdict === 'does_not_fit') {
    const room = certainty === 'verified' ? 'the verified room' : 'the room'
    return `Needs ${formatFeet(clearance.requiredFeet)} of ${dimension} and ${room} measures ${formatFeet(clearance.availableFeet)}, short by ${formatFeet(Math.abs(clearance.marginFeet))}.`
  }

  if (certainty === 'verified') {
    return `Fits with the verified room dimensions, with ${formatFeet(clearance.marginFeet)} to spare on ${dimension}.`
  }

  return `Clears the room in ${formatPercent(probability)} of plausible room measurements, with ${formatFeet(clearance.marginFeet)} to spare on ${dimension} at the measured value.`
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
 * Rank which dimension is worth taping by expected decision movement rather than
 * by lowest confidence. A dimension only matters when it is both uncertain and
 * still able to change the answer: 2 * P(others) * p * (1 - p) is zero for a
 * settled dimension and zero when the other dimensions already decide the case.
 */
const criticalMeasurementFor = (checks: readonly FitDimensionCheck[]): FitCriticalMeasurement | null => {
  const candidates = checks
    .filter(check => !check.verified)
    .map(check => {
      const others = checks
        .filter(other => other.measurementId !== check.measurementId)
        .reduce((total, other) => total * other.probability, 1)
      return {
        measurementId: check.measurementId,
        label: check.label,
        decisionImpact: 2 * others * check.probability * (1 - check.probability),
        probabilityIfConfirmed: others * (check.marginFeet >= 0 ? 1 : 0)
      }
    })
    .filter(candidate => candidate.decisionImpact > IMPACT_EPSILON)
    .sort((a, b) => b.decisionImpact - a.decisionImpact || a.measurementId.localeCompare(b.measurementId))

  return candidates[0] ?? null
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
      certainty: 'estimated',
      orientation: 'long_along_width',
      checks: [],
      clearance: null,
      clearanceFeet: null,
      criticalMeasurement: null,
      summary: summarize('unsupported', 'estimated', 0, null),
      modelVersion: FIT_CHECK_MODEL_VERSION
    }
  }

  const candidates = [
    orientationResult(item, width, length, height, 'long_along_width'),
    orientationResult(item, width, length, height, 'long_along_length')
  ]
  const best = candidates.reduce((winner, candidate) => candidate.probability > winner.probability ? candidate : winner)

  // One canonical clearance: the tightest dimension after its required access space.
  const clearance = best.checks.reduce<FitDimensionCheck>((tightest, check) =>
    check.marginFeet < tightest.marginFeet ? check : tightest, best.checks[0]!)
  const certainty: FitCertainty = best.checks.every(check => check.verified) ? 'verified' : 'estimated'
  const verdict = verdictFor(best.probability)

  return {
    item,
    verdict,
    probability: best.probability,
    certainty,
    orientation: best.orientation,
    checks: best.checks,
    clearance,
    clearanceFeet: clearance.marginFeet,
    criticalMeasurement: criticalMeasurementFor(best.checks),
    summary: summarize(verdict, certainty, best.probability, clearance),
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
  total: number
  fits: number
  uncertain: number
  doesNotFit: number
  /** The measurement that would resolve the most undecided items if it were taped. */
  decidingMeasurementId: FitDimensionId | null
  decidingLabel: string | null
  allResolved: boolean
  headline: string
}

export const summarizeRoomFit = (results: readonly FitCheckResult[]): FitCheckSummary => {
  const fits = results.filter(result => result.verdict === 'fits').length
  const uncertain = results.filter(result => result.verdict === 'uncertain').length
  const doesNotFit = results.filter(result => result.verdict === 'does_not_fit').length

  const impactByMeasurement = new Map<FitDimensionId, { impact: number, label: string }>()
  results
    .filter(result => result.verdict === 'uncertain' && result.criticalMeasurement)
    .forEach(result => {
      const critical = result.criticalMeasurement!
      const existing = impactByMeasurement.get(critical.measurementId)
      impactByMeasurement.set(critical.measurementId, {
        impact: (existing?.impact ?? 0) + critical.decisionImpact,
        label: critical.label
      })
    })
  const deciding = [...impactByMeasurement.entries()]
    .sort((a, b) => b[1].impact - a[1].impact || a[0].localeCompare(b[0]))[0]

  return {
    total: results.length,
    fits,
    uncertain,
    doesNotFit,
    decidingMeasurementId: deciding?.[0] ?? null,
    decidingLabel: deciding?.[1].label ?? null,
    allResolved: uncertain === 0,
    headline: `${fits} of ${results.length} common items fit with the current room measurements.`
  }
}
