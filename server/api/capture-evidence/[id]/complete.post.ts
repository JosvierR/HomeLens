import { readContractBody, apiFailure, ApiContractError } from '../../../utils/api-contract'
import { requireUser } from '../../../utils/require-user'
import { captureEvidenceCompleteSchema } from '~~/shared/persistence-contracts'
import { getRequestId, logServerEvent } from '../../../utils/observability'

export default defineEventHandler(async (event) => {
  const started = Date.now()
  try {
    const { user, supabase } = await requireUser(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw new ApiContractError(400, 'INVALID_REQUEST', 'Evidence id is required.')
    const body = await readContractBody(event, captureEvidenceCompleteSchema)

    const { data: existing, error: existingError } = await supabase
      .from('capture_evidence')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existingError) throw existingError
    if (!existing) throw new ApiContractError(404, 'NOT_FOUND', 'Capture evidence not found.')
    if (existing.status === 'ready') {
      return { evidence: existing, requestId: getRequestId(event) }
    }

    const { data: listed, error: listError } = await supabase.storage
      .from('scan-evidence')
      .list(`${user.id}/${existing.project_id}/${existing.scan_id}`, {
        search: id
      })
    if (listError) throw listError
    const objectReady = (listed ?? []).some((item: { name: string }) => item.name.startsWith(id))
    if (!objectReady) {
      throw new ApiContractError(409, 'CONFLICT', 'Upload is not present in storage yet.')
    }

    const { data, error } = await supabase.from('capture_evidence').update({
      status: body.accepted ? 'ready' : 'rejected',
      sharpness_score: body.sharpnessScore ?? null,
      brightness_score: body.brightnessScore ?? null,
      quality_bucket: body.qualityBucket ?? null,
      accepted: body.accepted,
      rejection_reason: body.rejectionReason ?? null,
      device_family: body.deviceFamily ?? null
    }).eq('id', id).eq('user_id', user.id).select('*').single()
    if (error) throw error

    logServerEvent(event, {
      operation: 'capture-evidence.complete',
      success: true,
      duration: Date.now() - started,
      scanId: existing.scan_id
    })
    return { evidence: data, requestId: getRequestId(event) }
  } catch (error) {
    logServerEvent(event, { operation: 'capture-evidence.complete', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
