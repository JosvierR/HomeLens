import { describe, expect, it } from 'vitest'
import { recordEvidence } from '../shared/calibration'
import { InMemoryEvidenceRepository } from '../shared/evidence-repository'

const evidence = recordEvidence({
  id: 'evidence-1', scanId: 'scan-1', roomId: 'room-1', measurementId: 'height', measurementType: 'height',
  estimatedValue: 9.1, estimatedConfidence: 0.71, verifiedValue: 9, modelVersion: 'v1', captureMethod: 'camera',
  deviceFamily: 'phone', roomCategory: 'living-area', verificationSource: 'manual', decisionStabilityBefore: 0.7,
  decisionStabilityAfter: 0.92, createdAt: '2026-09-02T12:00:00.000Z'
})

describe('InMemoryEvidenceRepository', () => {
  it('lists defensive copies, adds evidence, and finds contextual evidence', async () => {
    const repository = new InMemoryEvidenceRepository([evidence])
    const listed = await repository.listEvidence()
    listed[0]!.verifiedValue = 50
    expect((await repository.listEvidence())[0]?.verifiedValue).toBe(9)
    expect(await repository.findComparableEvidence({ measurementType: 'height', deviceFamily: 'phone' })).toHaveLength(1)

    await repository.addEvidence({ ...evidence, id: 'evidence-2' })
    expect(await repository.listEvidence()).toHaveLength(2)
    await expect(repository.addEvidence(evidence)).rejects.toThrow(/already exists/)
  })
})
