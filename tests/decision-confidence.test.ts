import { describe, expect, it } from 'vitest'
import { calculateDecisionConfidence, roomScanSchema, type DecisionRoomScan } from '../shared/decision-confidence'

const scan: DecisionRoomScan = {
  id: 'test-room', roomName: 'Living Room', createdAt: '2026-09-02T00:00:00.000Z', windows: 3, doors: 0,
  measurements: [
    { id: 'width', label: 'Width', value: 14.2, unit: 'ft', confidence: 0.94, source: 'estimated' },
    { id: 'length', label: 'Length', value: 18.6, unit: 'ft', confidence: 0.88, source: 'estimated' },
    { id: 'height', label: 'Ceiling height', value: 9.1, unit: 'ft', confidence: 0.71, source: 'estimated' }
  ]
}

const cloneScan = () => structuredClone(scan)

describe('RoomScan validation', () => {
  it.each([
    ['negative value', (candidate: Record<string, unknown>) => { (candidate.measurements as Array<Record<string, unknown>>)[0]!.value = -1 }],
    ['zero value', (candidate: Record<string, unknown>) => { (candidate.measurements as Array<Record<string, unknown>>)[0]!.value = 0 }],
    ['NaN value', (candidate: Record<string, unknown>) => { (candidate.measurements as Array<Record<string, unknown>>)[0]!.value = Number.NaN }],
    ['infinite value', (candidate: Record<string, unknown>) => { (candidate.measurements as Array<Record<string, unknown>>)[0]!.value = Number.POSITIVE_INFINITY }],
    ['extreme value', (candidate: Record<string, unknown>) => { (candidate.measurements as Array<Record<string, unknown>>)[0]!.value = 10_000 }],
    ['confidence above one', (candidate: Record<string, unknown>) => { (candidate.measurements as Array<Record<string, unknown>>)[0]!.confidence = 1.1 }],
    ['confidence below zero', (candidate: Record<string, unknown>) => { (candidate.measurements as Array<Record<string, unknown>>)[0]!.confidence = -0.1 }],
    ['unknown unit', (candidate: Record<string, unknown>) => { (candidate.measurements as Array<Record<string, unknown>>)[0]!.unit = 'm' }],
    ['duplicate ids', (candidate: Record<string, unknown>) => { (candidate.measurements as Array<Record<string, unknown>>)[1]!.id = 'width' }],
    ['missing required measurement', (candidate: Record<string, unknown>) => { candidate.measurements = (candidate.measurements as Array<Record<string, unknown>>).filter(item => item.id !== 'height') }],
    ['missing field', (candidate: Record<string, unknown>) => { delete (candidate.measurements as Array<Record<string, unknown>>)[0]!.label }],
    ['unknown source', (candidate: Record<string, unknown>) => { (candidate.measurements as Array<Record<string, unknown>>)[0]!.source = 'sensor' }]
  ])('rejects %s', (_label, mutate) => {
    const candidate = structuredClone(scan) as unknown as Record<string, unknown>
    mutate(candidate)
    expect(roomScanSchema.safeParse(candidate).success).toBe(false)
  })

  it('requires manually verified measurements to use confidence one', () => {
    const candidate = cloneScan()
    candidate.measurements[0]!.source = 'manual'
    expect(roomScanSchema.safeParse(candidate).success).toBe(false)
  })
})

describe('calculateDecisionConfidence', () => {
  it('returns a reproducible result for the same input and configuration', () => {
    expect(calculateDecisionConfidence(scan, 777)).toEqual(calculateDecisionConfidence(scan, 777))
  })

  it('rejects invalid deterministic configuration', () => {
    expect(() => calculateDecisionConfidence(scan, 0)).toThrow(/positive integer/)
    expect(() => calculateDecisionConfidence(scan, 2.5)).toThrow(/positive integer/)
  })

  it('keeps stability and every distribution value in the 0..1 contract', () => {
    const result = calculateDecisionConfidence(scan)
    expect(result.bandStability).toBeGreaterThanOrEqual(0)
    expect(result.bandStability).toBeLessThanOrEqual(1)
    Object.values(result.bandDistribution).forEach(value => {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    })
    expect(Object.values(result.bandDistribution).reduce((total, value) => total + value, 0)).toBeCloseTo(1)
  })

  it('makes fully verified measurements deterministic and removes them from review', () => {
    const verified = cloneScan()
    verified.measurements.forEach(measurement => { measurement.confidence = 1; measurement.source = 'manual' })
    const result = calculateDecisionConfidence(verified)
    expect(result.bandStability).toBe(1)
    expect(result.likelyRange.low).toBe(result.likelyRange.high)
    expect(result.verificationQueue).toEqual([])
  })

  it('models single and multiple uncertain inputs without leaving the stability contract', () => {
    const single = cloneScan()
    single.measurements.forEach(measurement => { measurement.confidence = 1; measurement.source = 'manual' })
    single.measurements[2]!.confidence = 0.2
    single.measurements[2]!.source = 'estimated'
    const multiple = cloneScan()
    multiple.measurements.forEach(measurement => { measurement.confidence = 0.05 })
    expect(calculateDecisionConfidence(single).bandStability).toBeLessThanOrEqual(1)
    expect(calculateDecisionConfidence(multiple).bandStability).toBeLessThanOrEqual(1)
  })

  it('allows a higher-confidence, high-impact measurement to outrank a lower-confidence irrelevant one', () => {
    const candidate = cloneScan()
    candidate.measurements.push({ id: 'ambient', label: 'Ambient note', value: 1, unit: 'ft', confidence: 0.5, source: 'estimated' })
    candidate.measurements[2]!.confidence = 0.75
    const result = calculateDecisionConfidence(candidate)
    expect(result.verificationQueue.findIndex(item => item.measurementId === 'height')).toBeLessThan(
      result.verificationQueue.findIndex(item => item.measurementId === 'ambient')
    )
    expect(result.verificationQueue.find(item => item.measurementId === 'ambient')?.impactPercent).toBe(0)
  })

  it('uses calibrated reliability without overwriting raw confidence', () => {
    const result = calculateDecisionConfidence(scan, 600, { confidenceOverrides: { height: 0.5 } })
    const height = result.verificationQueue.find(item => item.measurementId === 'height')!
    expect(height).toMatchObject({ confidence: 0.5, rawConfidence: 0.71, calibratedConfidence: 0.5, calibrationApplied: true })
    expect(scan.measurements[2]?.confidence).toBe(0.71)
  })
})
