import type { MeasurementEvidence } from '~~/shared/calibration'
import { recordEvidence } from '~~/shared/calibration'

const context = {
  modelVersion: 'geometry-v1',
  captureMethod: 'simulated-geometry',
  deviceFamily: 'demo-phone',
  roomCategory: 'living-area'
} as const

const makeSeries = (
  measurementType: 'width' | 'length' | 'height',
  count: number,
  estimatedConfidence: number,
  successfulSamples: number,
  baseValue: number
): MeasurementEvidence[] => Array.from({ length: count }, (_, index) => {
  const isWithinTolerance = index < successfulSamples
  const signedError = (index % 2 === 0 ? 1 : -1) * (isWithinTolerance ? 0.012 : 0.065)
  const estimatedValue = baseValue + (index % 5) * 0.04
  const verifiedValue = estimatedValue * (1 + signedError)
  return recordEvidence({
    id: `demo-${measurementType}-${String(index + 1).padStart(3, '0')}`,
    scanId: `demo-history-${measurementType}-${index + 1}`,
    roomId: `demo-room-${measurementType}-${index + 1}`,
    measurementId: measurementType,
    measurementType,
    estimatedValue,
    estimatedConfidence,
    verifiedValue,
    ...context,
    verificationSource: 'manual',
    decisionStabilityBefore: 0.72,
    decisionStabilityAfter: isWithinTolerance ? 0.91 : 0.84,
    createdAt: `2026-06-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
    demo: true
  })
})

/** Synthetic fixtures only. These are not customer measurements. */
export const demoEvidence: MeasurementEvidence[] = [
  ...makeSeries('height', 36, 0.74, 24, 9.0),
  ...makeSeries('width', 20, 0.94, 18, 14.0),
  ...makeSeries('length', 16, 0.64, 14, 18.2)
]
