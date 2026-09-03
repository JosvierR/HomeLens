import { calculateHomeLensAnalysis } from '~~/shared/analysis'
import { roomScanSchema } from '~~/shared/decision-confidence'
import { apiFailure, readContractBody, runDomainEngine } from '../utils/api-contract'
import { getEvidenceRepository } from '../utils/evidence-repository'

export default defineEventHandler(async event => {
  try {
    const scan = await readContractBody(event, roomScanSchema)
    const evidence = await getEvidenceRepository().listEvidence().catch(() => [])
    return runDomainEngine(() => calculateHomeLensAnalysis(scan, evidence).calibration)
  } catch (error) {
    return apiFailure(event, error)
  }
})
