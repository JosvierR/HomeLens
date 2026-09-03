import { recordEvidence } from '~~/shared/calibration'
import { calculateHomeLensAnalysis } from '~~/shared/analysis'
import { applyManualVerification, manualVerificationRequestSchema } from '~~/shared/verification'
import { ApiContractError, apiFailure, readContractBody } from '../../utils/api-contract'
import { getEvidenceRepository } from '../../utils/evidence-repository'

export default defineEventHandler(async event => {
  try {
    const request = await readContractBody(event, manualVerificationRequestSchema)
    const repository = getEvidenceRepository()
    const existingEvidence = await repository.listEvidence().catch(() => [])
    const before = calculateHomeLensAnalysis(request.scan, existingEvidence)
    const measurement = request.scan.measurements.find(item => item.id === request.measurementId)
    if (!measurement) {
      throw new ApiContractError(400, 'INVALID_REQUEST', 'Request validation failed.', [
        { path: 'measurementId', message: 'Measurement does not exist in the supplied scan.' }
      ])
    }

    const verifiedAt = new Date().toISOString()
    const verifiedScan = applyManualVerification(request.scan, request.measurementId, request.verifiedValue, verifiedAt)
    const after = calculateHomeLensAnalysis(verifiedScan, existingEvidence)
    const evidence = recordEvidence({
      id: `evidence-${globalThis.crypto.randomUUID()}`,
      scanId: request.scan.id,
      roomId: request.scan.roomId ?? request.scan.id,
      measurementId: measurement.id,
      measurementType: measurement.id,
      estimatedValue: measurement.originalEstimate?.value ?? measurement.value,
      estimatedConfidence: measurement.rawConfidence ?? measurement.originalEstimate?.confidence ?? measurement.confidence,
      verifiedValue: request.verifiedValue,
      modelVersion: request.scan.modelVersion,
      captureMethod: request.scan.captureMethod,
      deviceFamily: request.scan.deviceFamily,
      roomCategory: request.scan.roomCategory,
      verificationSource: 'manual',
      decisionStabilityBefore: before.decision.bandStability,
      decisionStabilityAfter: after.decision.bandStability,
      createdAt: verifiedAt
    })
    await repository.addEvidence(evidence)
    const analysis = calculateHomeLensAnalysis(verifiedScan, [...existingEvidence, evidence])
    return { scan: verifiedScan, evidence, analysis }
  } catch (error) {
    return apiFailure(event, error)
  }
})
