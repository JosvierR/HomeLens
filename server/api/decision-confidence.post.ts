import { calculateDecisionConfidence, roomScanSchema } from '../../shared/decision-confidence'

export default defineEventHandler(async event => {
  const body = await readBody(event)
  const scan = roomScanSchema.parse(body)
  return calculateDecisionConfidence(scan)
})
