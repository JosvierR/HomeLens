import { calculateDecisionConfidence, roomScanSchema } from '~~/shared/decision-confidence'
import { apiFailure, readContractBody, runDomainEngine } from '../utils/api-contract'

defineRouteMeta({
  openAPI: {
    tags: ['Decision'],
    summary: 'Decision confidence only',
    description: '600 deterministic scenarios. Returns band stability and the verification queue ranked by decision impact.',
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object', description: 'DecisionRoomScan' } } }
    },
    responses: {
      200: { description: 'Stability, likely range, and verification queue.' },
      400: { description: 'Invalid scan contract.' }
    }
  }
})

export default defineEventHandler(async event => {
  try {
    const scan = await readContractBody(event, roomScanSchema)
    return runDomainEngine(() => calculateDecisionConfidence(scan))
  } catch (error) {
    return apiFailure(event, error)
  }
})
