import { calculateDecisionConfidence, roomScanSchema } from '~~/shared/decision-confidence'
import { apiFailure, readContractBody, runDomainEngine } from '../utils/api-contract'

export default defineEventHandler(async event => {
  try {
    const scan = await readContractBody(event, roomScanSchema)
    return runDomainEngine(() => calculateDecisionConfidence(scan))
  } catch (error) {
    return apiFailure(event, error)
  }
})
