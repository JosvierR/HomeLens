import { describe, expect, it } from 'vitest'
import { completeScanSchema } from '../shared/persistence-contracts'

const valid = {
  roomName: 'Living Room',
  measurements: [
    { key: 'width', label: 'Width', value: 12.5 },
    { key: 'length', label: 'Length', value: 16 },
    { key: 'height', label: 'Ceiling height', value: 9 }
  ],
  windows: 2,
  doors: 1,
  deviceFamily: 'ios-phone',
  acceptedFrameCount: 3
}

describe('completed scan contract', () => {
  it('accepts a complete set of real inputs', () => {
    expect(completeScanSchema.parse(valid)).toEqual(valid)
  })

  it('rejects duplicate or missing required dimensions', () => {
    const invalid = structuredClone(valid)
    invalid.measurements[2]!.key = 'width'
    expect(() => completeScanSchema.parse(invalid)).toThrow()
  })

  it('requires at least three accepted camera frames', () => {
    expect(() => completeScanSchema.parse({ ...valid, acceptedFrameCount: 2 })).toThrow()
  })
})
