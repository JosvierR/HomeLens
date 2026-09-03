import { describe, expect, it } from 'vitest'
import {
  EMPTY_DISPLAY,
  formatArea,
  formatCount,
  formatFeet,
  formatFeetPrecise,
  formatFeetRange,
  formatFeetTechnical,
  formatIndex,
  formatPercent,
  formatPercentPoints,
  formatPercentPrecise,
  formatSignedFeet
} from '../shared/format'

describe('display formatting', () => {
  it('never leaks raw floating-point precision into the UI', () => {
    const raw = 12.478682125299244
    expect(formatFeet(raw)).toBe('12.5 ft')
    expect(formatFeetPrecise(raw)).toBe('12.48 ft')
    expect(formatFeetTechnical(raw)).toBe('12.479 ft')
    expect(formatFeet(raw)).not.toContain('12.4786')
  })

  it('keeps a trailing zero so measurements line up', () => {
    expect(formatFeet(12)).toBe('12.0 ft')
    expect(formatFeetPrecise(12)).toBe('12.00 ft')
  })

  it('signs clearance values and never prints negative zero', () => {
    expect(formatSignedFeet(3.4999)).toBe('+3.5 ft')
    expect(formatSignedFeet(-0.62)).toBe('-0.6 ft')
    expect(formatSignedFeet(-0.001)).toBe('0.0 ft')
  })

  it('rounds percentages consistently', () => {
    expect(formatPercent(0.786)).toBe('79%')
    expect(formatPercent(1)).toBe('100%')
    expect(formatPercentPrecise(0.016234)).toBe('1.6%')
    expect(formatPercentPoints(7.24311)).toBe('7.2%')
  })

  it('carries the unit once in a range', () => {
    expect(formatFeetRange(11.7512, 13.09)).toBe('11.8\u201313.1 ft')
    expect(formatFeetRange(11.8, undefined)).toBe(EMPTY_DISPLAY)
  })

  it('rounds unitless engine outputs', () => {
    expect(formatIndex(128.6)).toBe('129')
    expect(formatArea(150.4)).toBe('150 ft\u00B2')
    expect(formatCount(3)).toBe('3')
  })

  it('renders a placeholder instead of NaN, Infinity, or null', () => {
    for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, 'x']) {
      expect(formatFeet(value)).toBe(EMPTY_DISPLAY)
      expect(formatPercent(value)).toBe(EMPTY_DISPLAY)
      expect(formatIndex(value)).toBe(EMPTY_DISPLAY)
      expect(formatSignedFeet(value)).toBe(EMPTY_DISPLAY)
    }
  })

  it('supports a custom unit label', () => {
    expect(formatFeet(2.5, 'm')).toBe('2.5 m')
  })
})
