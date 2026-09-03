import { ApiContractError, apiFailure } from '../../utils/api-contract'
import { requireUser } from '../../utils/require-user'
import { MODEL_VERSIONS } from '~~/shared/model-versions'
import { getRequestId, logServerEvent } from '../../utils/observability'

/** One-shot bootstrap for the public demo scan flow (anonymous or signed-in). */
export default defineEventHandler(async event => {
  const started = Date.now()
  try {
    const { user, supabase } = await requireUser(event)
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')

    const { data: project, error: projectError } = await supabase.from('projects').insert({
      user_id: user.id,
      name: `Scan ${stamp}`,
      status: 'active'
    }).select('id, name').single()
    if (projectError) throw projectError

    const { data: room, error: roomError } = await supabase.from('rooms').insert({
      user_id: user.id,
      project_id: project.id,
      name: 'Room',
      room_type: 'room'
    }).select('id, name').single()
    if (roomError) throw roomError

    const { data: scan, error: scanError } = await supabase.from('scans').insert({
      user_id: user.id,
      room_id: room.id,
      status: 'draft',
      capture_mode: 'camera',
      started_at: new Date().toISOString(),
      measurement_model_version: MODEL_VERSIONS.measurement,
      decision_model_version: MODEL_VERSIONS.decision,
      capture_policy_version: MODEL_VERSIONS.capturePolicy,
      calibration_version: MODEL_VERSIONS.calibration
    }).select('id').single()
    if (scanError) throw scanError

    logServerEvent(event, {
      operation: 'demo.start-scan',
      success: true,
      duration: Date.now() - started,
      scanId: scan.id
    })
    return {
      projectId: project.id,
      roomId: room.id,
      scanId: scan.id,
      roomName: room.name,
      requestId: getRequestId(event)
    }
  } catch (error) {
    if (error instanceof ApiContractError) return apiFailure(event, error)
    logServerEvent(event, { operation: 'demo.start-scan', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
