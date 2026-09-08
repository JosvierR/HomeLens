import { calculateHomeLensAnalysis } from '~~/shared/analysis'
import { roomScanSchema } from '~~/shared/decision-confidence'
import { apiFailure, readContractBody, runDomainEngine } from '../utils/api-contract'
import { getEvidenceRepository } from '../utils/evidence-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Decision'],
    summary: 'Full HomeLens analysis',
    description: 'Runs decision confidence, scan rescue, and calibration on a room scan. Same engine the analysis page uses.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { type: 'object', description: 'DecisionRoomScan (Zod roomScanSchema)' }
        }
      }
    },
    responses: {
      200: { description: 'Decision, rescue, and calibration result.' },
      400: { description: 'Invalid scan contract.' }
    }
  }
})

export default defineEventHandler(async event => {
  try {
    const scan = await readContractBody(event, roomScanSchema)
    const evidence = await getEvidenceRepository().listEvidence().catch(() => [])
    return runDomainEngine(() => calculateHomeLensAnalysis(scan, evidence))
  } catch (error) {
    return apiFailure(event, error)
  }
})
