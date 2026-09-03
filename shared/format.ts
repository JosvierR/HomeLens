/**
 * Single source of display formatting. Raw floating-point results from the
 * geometry, decision, and calibration engines must never reach the UI directly.
 */

export const EMPTY_DISPLAY = '—'

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const fixed = (value: number, decimals: number) => {
  // Avoid "-0.0" for values that round to zero from below.
  const rounded = Number(value.toFixed(decimals))
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(decimals)
}

/** Homeowner-facing length, e.g. "12.5 ft". */
export const formatFeet = (value: unknown, unit = 'ft') =>
  isNumber(value) ? `${fixed(value, 1)} ${unit}` : EMPTY_DISPLAY

/** Length where a tenth of a foot is not enough, e.g. "12.48 ft". */
export const formatFeetPrecise = (value: unknown, unit = 'ft') =>
  isNumber(value) ? `${fixed(value, 2)} ${unit}` : EMPTY_DISPLAY

/** Engineering read-out inside Technical details, e.g. "12.479 ft". */
export const formatFeetTechnical = (value: unknown, unit = 'ft') =>
  isNumber(value) ? `${fixed(value, 3)} ${unit}` : EMPTY_DISPLAY

/** An interval that carries the unit once, e.g. "11.8–13.1 ft". */
export const formatFeetRange = (low: unknown, high: unknown, unit = 'ft') =>
  isNumber(low) && isNumber(high)
    ? `${fixed(low, 1)}\u2013${fixed(high, 1)} ${unit}`
    : EMPTY_DISPLAY

/** Clearance or shortfall that reads better with an explicit sign, e.g. "+3.5 ft". */
export const formatSignedFeet = (value: unknown, unit = 'ft') => {
  if (!isNumber(value)) return EMPTY_DISPLAY
  const rendered = fixed(value, 1)
  return `${Number(rendered) > 0 ? '+' : ''}${rendered} ${unit}`
}

/** A 0..1 fraction as a whole percentage, e.g. 0.786 -> "79%". */
export const formatPercent = (fraction: unknown) =>
  isNumber(fraction) ? `${Math.round(fraction * 100)}%` : EMPTY_DISPLAY

/** A 0..1 fraction that needs sub-point resolution, e.g. 0.0162 -> "1.6%". */
export const formatPercentPrecise = (fraction: unknown) =>
  isNumber(fraction) ? `${fixed(fraction * 100, 1)}%` : EMPTY_DISPLAY

/** A value already expressed in percentage points, e.g. 7.2431 -> "7.2%". */
export const formatPercentPoints = (points: unknown) =>
  isNumber(points) ? `${fixed(points, 1)}%` : EMPTY_DISPLAY

export const formatArea = (squareFeet: unknown) =>
  isNumber(squareFeet) ? `${Math.round(squareFeet)} ft\u00B2` : EMPTY_DISPLAY

/** Unitless engine outputs such as the planning index. */
export const formatIndex = (value: unknown) =>
  isNumber(value) ? String(Math.round(value)) : EMPTY_DISPLAY

export const formatCount = (value: unknown) =>
  isNumber(value) ? String(Math.round(value)) : EMPTY_DISPLAY
