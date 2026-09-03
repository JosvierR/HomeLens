import { roomScanSchema } from '../../shared/decision-confidence'
import { recommendScanRescue } from '../../shared/scan-rescue'

export default defineEventHandler(async event => {
  const body = await readBody(event)
  const scan = roomScanSchema.parse(body)
  return recommendScanRescue(scan)
})
