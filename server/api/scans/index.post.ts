import { readContractBody, apiFailure, ApiContractError } from '../../utils/api-contract'
import { requireUser } from '../../utils/require-user'
import { createScanSchema } from '~~/shared/persistence-contracts'
import { MODEL_VERSIONS } from '~~/shared/model-versions'
import { getRequestId, logServerEvent } from '../../utils/observability'

export default defineEventHandler(async (event) => {
  const started = Date.now()
  try {
    const { user, supabase } = await requireUser(event)
    const body = await readContractBody(event, createScanSchema)
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', body.roomId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (roomError) throw roomError
    if (!room) throw new ApiContractError(404, 'NOT_FOUND', 'Room not found.')

    const { data, error } = await supabase.from('scans').insert({
      user_id: user.id,
      room_id: body.roomId,
      status: 'draft',
      capture_mode: body.captureMode,
      started_at: new Date().toISOString(),
      measurement_model_version: MODEL_VERSIONS.measurement,
      decision_model_version: MODEL_VERSIONS.decision,
      capture_policy_version: MODEL_VERSIONS.capturePolicy,
      calibration_version: MODEL_VERSIONS.calibration
    }).select('*').single()
    if (error) throw error
    logServerEvent(event, { operation: 'scans.create', success: true, duration: Date.now() - started })
    return { scan: data, requestId: getRequestId(event) }
  } catch (error) {
    logServerEvent(event, { operation: 'scans.create', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
