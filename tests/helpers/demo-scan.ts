import type { DecisionRoomScan } from '../shared/decision-confidence'

/** Minimal Living Room fixture matching demo geometry for unit tests. */
export const createDemoScanFixture = (): DecisionRoomScan => ({
  id: 'scan-test-1',
  roomId: 'room-test-1',
  roomName: 'Living Room',
  createdAt: '2026-01-01T00:00:00.000Z',
  modelVersion: 'geometry-v1',
  captureMethod: 'camera',
  windows: 3,
  doors: 2,
  measurements: [
    {
      id: 'width',
      label: 'Width',
      value: 14.2,
      unit: 'ft',
      confidence: 0.94,
      source: 'estimated',
      rawConfidence: 0.94,
      originalEstimate: { value: 14.2, confidence: 0.94, capturedAt: '2026-01-01T00:00:00.000Z' }
    },
    {
      id: 'length',
      label: 'Length',
      value: 18.6,
      unit: 'ft',
      confidence: 0.88,
      source: 'estimated',
      rawConfidence: 0.88,
      originalEstimate: { value: 18.6, confidence: 0.88, capturedAt: '2026-01-01T00:00:00.000Z' }
    },
    {
      id: 'height',
      label: 'Ceiling height',
      value: 9.1,
      unit: 'ft',
      confidence: 0.71,
      source: 'estimated',
      rawConfidence: 0.71,
      originalEstimate: { value: 9.1, confidence: 0.71, capturedAt: '2026-01-01T00:00:00.000Z' }
    }
  ]
})
