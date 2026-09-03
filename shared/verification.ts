import { z } from 'zod'
import type { HomeLensAnalysisResult } from './analysis'
import type { MeasurementEvidence } from './calibration'
import type { DecisionRoomScan } from './decision-confidence'
import { MAX_MEASUREMENT_VALUE_FEET, roomScanSchema } from './decision-confidence'

export const manualVerificationRequestSchema = z.object({
  scan: roomScanSchema,
  measurementId: z.string().trim().min(1).max(80),
  verifiedValue: z.number().finite().positive().max(MAX_MEASUREMENT_VALUE_FEET)
}).strict()

export type ManualVerificationRequest = z.infer<typeof manualVerificationRequestSchema>

export interface ManualVerificationResponse {
  scan: DecisionRoomScan
  evidence: MeasurementEvidence
  analysis: HomeLensAnalysisResult
}

export const applyManualVerification = (
  scanInput: DecisionRoomScan,
  measurementId: string,
  verifiedValue: number,
  verifiedAt: string
): DecisionRoomScan => {
  const request = manualVerificationRequestSchema.parse({ scan: scanInput, measurementId, verifiedValue })
  z.string().datetime({ offset: true }).parse(verifiedAt)
  const scan: DecisionRoomScan = {
    ...request.scan,
    measurements: request.scan.measurements.map(measurement => ({
      ...measurement,
      originalEstimate: measurement.originalEstimate ? { ...measurement.originalEstimate } : undefined,
      verification: measurement.verification ? { ...measurement.verification } : undefined
    }))
  }
  const measurement = scan.measurements.find(item => item.id === request.measurementId)
  if (!measurement) throw new Error(`Unknown measurement id: ${request.measurementId}`)

  const originalValue = measurement.originalEstimate?.value ?? measurement.value
  const originalConfidence = measurement.originalEstimate?.confidence ?? measurement.rawConfidence ?? measurement.confidence
  const previousValue = measurement.value
  const previousConfidence = measurement.confidence
  measurement.originalEstimate ??= {
    value: originalValue,
    confidence: originalConfidence,
    capturedAt: scan.createdAt
  }
  measurement.rawConfidence = originalConfidence
  measurement.value = request.verifiedValue
  measurement.source = 'manual'
  measurement.confidence = 1
  measurement.calibratedConfidence = undefined
  measurement.verification = {
    verifiedAt,
    verificationSource: 'manual',
    previousValue,
    previousConfidence
  }
  return roomScanSchema.parse(scan)
}
