import { calculateHomeLensAnalysis } from '~~/shared/analysis'
import { roomScanSchema } from '~~/shared/decision-confidence'
import { apiFailure, readContractBody, runDomainEngine } from '../utils/api-contract'
import { getEvidenceRepository } from '../utils/evidence-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Decision'],
    summary: 'Confidence calibration',
    description: 'Error Atlas suggestion. Production evidence is never mixed with synthetic demo history.',
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object', description: 'DecisionRoomScan' } } }
    },
    responses: {
      200: { description: 'Calibration analysis for the scan.' },
      400: { description: 'Invalid scan contract.' }
    }
  }
})

export default defineEventHandler(async event => {
  try {
    const scan = await readContractBody(event, roomScanSchema)
    const evidence = await getEvidenceRepository().listEvidence().catch(() => [])
    return runDomainEngine(() => calculateHomeLensAnalysis(scan, evidence).calibration)
  } catch (error) {
    return apiFailure(event, error)
  }
})
