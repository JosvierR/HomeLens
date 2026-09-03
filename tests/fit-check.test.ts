import { describe, expect, it } from 'vitest'
import type { DecisionMeasurement, DecisionRoomScan } from '../shared/decision-confidence'
import { FIT_CATALOG, evaluateItemFit, evaluateRoomFit, summarizeRoomFit } from '../shared/fit-check'

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
  it('confirms a fit with certainty once every dimension is taped', () => {
    const scan = scanOf([
      verified('width', 'Width', 14),
      verified('length', 'Length', 16),
      verified('height', 'Ceiling height', 9)
    ])

    const result = evaluateItemFit(scan, item('king_bed'))

    expect(result.verdict).toBe('fits')
    expect(result.probability).toBe(1)
    expect(result.nextVerification).toBeNull()
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
    expect(result.limiting?.marginFeet).toBeLessThan(0)
    expect(result.summary).toContain('short by')
  })

  it('reports a probability instead of a yes or no when the room is borderline', () => {
    const scan = scanOf([
      estimated('width', 'Width', 7.4, 0.8),
      estimated('length', 'Length', 6, 0.5),
      estimated('height', 'Ceiling height', 8, 0.2)
    ])

    const result = evaluateItemFit(scan, item('three_seat_sofa'))

    expect(result.verdict).toBe('tight')
    expect(result.probability).toBeGreaterThan(0.5)
    expect(result.probability).toBeLessThan(0.9)
    expect(result.nextVerification?.measurementId).toBe('width')
    expect(result.nextVerification?.probabilityIfConfirmed).toBeGreaterThan(result.probability)
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

  it('checks ceiling height for height-sensitive items', () => {
    const lowCeiling = scanOf([
      verified('width', 'Width', 12),
      verified('length', 'Length', 14),
      verified('height', 'Ceiling height', 7)
    ])

    expect(evaluateItemFit(lowCeiling, item('bunk_bed')).verdict).toBe('does_not_fit')
    expect(evaluateItemFit(lowCeiling, item('bunk_bed')).limiting?.measurementId).toBe('height')
  })

  it('never guesses when a required dimension is missing', () => {
    const scan = scanOf([
      verified('width', 'Width', 12),
      verified('length', 'Length', 14)
    ])

    const result = evaluateItemFit(scan, item('bunk_bed'))

    expect(result.verdict).toBe('unsupported')
    expect(result.checks).toHaveLength(0)
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
    expect(summary.fits + summary.tight + summary.doesNotFit).toBe(first.length)
    expect(summary.headline).toContain(`of ${first.length} items`)
  })
})
