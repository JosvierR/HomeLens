import { describe, expect, it } from 'vitest'
import type { DecisionMeasurement, DecisionRoomScan } from '../shared/decision-confidence'
import { FIT_CATALOG, evaluateItemFit, evaluateRoomFit, summarizeRoomFit } from '../shared/fit-check'
import { formatFeet } from '../shared/format'

const item = (id: string) => {
  const found = FIT_CATALOG.find(entry => entry.id === id)
  if (!found) throw new Error(`Unknown catalog item: ${id}`)
  return found
}

const estimated = (
  id: string,
  label: string,
  value: number,
  spread: number,
  confidence = 0.8
): DecisionMeasurement => ({
  id,
  label,
  value,
  unit: 'ft',
  confidence,
  rawConfidence: confidence,
  source: 'estimated',
  uncertaintyLow: value - spread,
  uncertaintyHigh: value + spread
})

const verified = (id: string, label: string, value: number): DecisionMeasurement => ({
  id,
  label,
  value,
  unit: 'ft',
  confidence: 1,
  rawConfidence: 1,
  source: 'manual'
})

const scanOf = (measurements: DecisionMeasurement[]): DecisionRoomScan => ({
  id: 'scan_fit_test',
  roomName: 'Test room',
  createdAt: '2026-09-03T12:00:00.000Z',
  windows: 1,
  doors: 1,
  measurements
})

describe('fit check', () => {
  it('answers with certainty once every dimension is taped', () => {
    const scan = scanOf([
      verified('width', 'Width', 14),
      verified('length', 'Length', 16),
      verified('height', 'Ceiling height', 9)
    ])

    const result = evaluateItemFit(scan, item('king_bed'))

    expect(result.verdict).toBe('fits')
    expect(result.probability).toBe(1)
    expect(result.certainty).toBe('verified')
    expect(result.criticalMeasurement).toBeNull()
    expect(result.summary).toContain('verified room dimensions')
  })

  it('is deterministic in both directions for a verified room', () => {
    const scan = scanOf([
      verified('width', 'Width', 8),
      verified('length', 'Length', 9),
      verified('height', 'Ceiling height', 9)
    ])

    const result = evaluateItemFit(scan, item('sectional_sofa'))

    expect(result.verdict).toBe('does_not_fit')
    expect(result.probability).toBe(0)
    expect(result.criticalMeasurement).toBeNull()
  })

  it('accepts an exact fit with no space left over', () => {
    const bed = item('king_bed')
    const scan = scanOf([
      verified('width', 'Width', bed.shortSideFeet + bed.clearanceFeet),
      verified('length', 'Length', bed.longSideFeet),
      verified('height', 'Ceiling height', 9)
    ])

    const result = evaluateItemFit(scan, bed)

    expect(result.verdict).toBe('fits')
    expect(result.probability).toBe(1)
    expect(result.clearanceFeet).toBe(0)
  })

  it('rejects an item that cannot physically clear the room', () => {
    const scan = scanOf([
      estimated('width', 'Width', 8, 0.3),
      estimated('length', 'Length', 9, 0.3),
      estimated('height', 'Ceiling height', 8, 0.2)
    ])

    const result = evaluateItemFit(scan, item('sectional_sofa'))

    expect(result.verdict).toBe('does_not_fit')
    expect(result.probability).toBeLessThan(0.05)
    expect(result.clearanceFeet).toBeLessThan(0)
    expect(result.summary).toContain('short by')
  })

  it('reports a probability instead of a yes or no when width is borderline', () => {
    const scan = scanOf([
      estimated('width', 'Width', 7.4, 0.8),
      estimated('length', 'Length', 6, 0.5),
      estimated('height', 'Ceiling height', 8, 0.2)
    ])

    const result = evaluateItemFit(scan, item('three_seat_sofa'))

    expect(result.verdict).toBe('uncertain')
    expect(result.probability).toBeGreaterThan(0.5)
    expect(result.probability).toBeLessThan(0.9)
    expect(result.certainty).toBe('estimated')
    expect(result.criticalMeasurement?.measurementId).toBe('width')
    expect(result.criticalMeasurement?.probabilityIfConfirmed).toBeGreaterThan(result.probability)
    expect(result.summary).toContain('plausible room measurements')
  })

  it('points at length when length is the borderline dimension', () => {
    const scan = scanOf([
      verified('width', 'Width', 6),
      estimated('length', 'Length', 7.1, 0.7),
      estimated('height', 'Ceiling height', 8, 0.2)
    ])

    const result = evaluateItemFit(scan, item('three_seat_sofa'))

    expect(result.verdict).toBe('uncertain')
    expect(result.criticalMeasurement?.measurementId).toBe('length')
  })

  it('asks for the decision-critical dimension, not the least confident one', () => {
    // Length carries the lower confidence, but it has feet of slack, so taping it
    // cannot move the answer. Width is the dimension the sectional actually needs.
    const scan = scanOf([
      estimated('width', 'Width', 9.3, 0.6, 0.82),
      estimated('length', 'Length', 24, 3, 0.67),
      estimated('height', 'Ceiling height', 8, 0.2, 0.9)
    ])

    const result = evaluateItemFit(scan, item('sectional_sofa'))
    const width = result.checks.find(check => check.measurementId === 'width')
    const length = result.checks.find(check => check.measurementId === 'length')

    expect(result.verdict).toBe('uncertain')
    expect(result.criticalMeasurement?.measurementId).toBe('width')
    expect(width!.probability).toBeLessThan(length!.probability)
  })

  it('uses the orientation that gives the item its best chance', () => {
    const scan = scanOf([
      verified('width', 'Width', 6),
      verified('length', 'Length', 12),
      verified('height', 'Ceiling height', 9)
    ])

    const result = evaluateItemFit(scan, item('three_seat_sofa'))

    expect(result.orientation).toBe('long_along_length')
    expect(result.verdict).toBe('fits')
  })

  it('holds an item to its required walkway, not just its footprint', () => {
    const table = item('dining_table_six')
    // The 6 x 3 ft footprint clears an 8 x 8 ft room; the 6 ft of chair pull-out does not.
    const scan = scanOf([
      verified('width', 'Width', 8),
      verified('length', 'Length', 8),
      verified('height', 'Ceiling height', 9)
    ])

    const result = evaluateItemFit(scan, table)

    expect(result.verdict).toBe('does_not_fit')
    expect(result.clearance?.requiredFeet).toBe(table.shortSideFeet + table.clearanceFeet)
    expect(result.clearance?.availableFeet).toBeGreaterThan(table.longSideFeet)
  })

  it('reports the ceiling shortfall for height-limited items', () => {
    const scan = scanOf([
      verified('width', 'Width', 12),
      verified('length', 'Length', 14),
      verified('height', 'Ceiling height', 6.9)
    ])

    const result = evaluateItemFit(scan, item('bunk_bed'))

    expect(result.verdict).toBe('does_not_fit')
    expect(result.clearance?.measurementId).toBe('height')
    expect(result.clearance?.requiredFeet).toBe(7.5)
    expect(result.clearanceFeet).toBeCloseTo(-0.6, 5)
    expect(result.summary).toContain('short by 0.6 ft')
  })

  it('never guesses when a required dimension is missing', () => {
    const scan = scanOf([
      verified('width', 'Width', 12),
      verified('length', 'Length', 14)
    ])

    const result = evaluateItemFit(scan, item('bunk_bed'))

    expect(result.verdict).toBe('unsupported')
    expect(result.checks).toHaveLength(0)
    expect(result.clearanceFeet).toBeNull()
  })

  it('quotes one clearance number that always matches the copy', () => {
    const scan = scanOf([
      estimated('width', 'Width', 10.5, 0.9),
      estimated('length', 'Length', 12, 0.5),
      estimated('height', 'Ceiling height', 8.2, 0.3)
    ])

    for (const result of evaluateRoomFit(scan)) {
      if (!result.clearance) continue
      const smallestMargin = Math.min(...result.checks.map(check => check.marginFeet))
      expect(result.clearanceFeet).toBe(smallestMargin)
      expect(result.clearanceFeet).toBe(result.clearance.marginFeet)
      const quoted = formatFeet(Math.abs(result.clearanceFeet!))
      expect(result.summary).toContain(quoted)
      expect(result.summary).toContain(result.clearance.label.toLowerCase())
    }
  })

  it('ranks the catalog deterministically and summarizes what is undecided', () => {
    const scan = scanOf([
      estimated('width', 'Width', 10.5, 0.9),
      estimated('length', 'Length', 12, 0.5),
      estimated('height', 'Ceiling height', 8.2, 0.3)
    ])

    const first = evaluateRoomFit(scan)
    const second = evaluateRoomFit(scan)

    expect(first.map(result => result.item.id)).toEqual(second.map(result => result.item.id))
    expect(first[0]!.probability).toBeGreaterThanOrEqual(first[first.length - 1]!.probability)

    const summary = summarizeRoomFit(first)
    expect(summary.fits + summary.uncertain + summary.doesNotFit).toBe(first.length)
    expect(summary.headline).toBe(`${summary.fits} of ${first.length} common items fit with the current room measurements.`)
    expect(summary.allResolved).toBe(summary.uncertain === 0)
  })

  it('marks a fully decided room as resolved with nothing left to check', () => {
    const scan = scanOf([
      verified('width', 'Width', 16),
      verified('length', 'Length', 20),
      verified('height', 'Ceiling height', 9)
    ])

    const summary = summarizeRoomFit(evaluateRoomFit(scan))

    expect(summary.uncertain).toBe(0)
    expect(summary.allResolved).toBe(true)
    expect(summary.decidingMeasurementId).toBeNull()
  })
})
