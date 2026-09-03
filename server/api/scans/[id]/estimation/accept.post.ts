import { acceptPhotoEstimateSchema } from '~~/shared/photo-estimation-api'
import { ApiContractError, apiFailure, readContractBody } from '../../../../utils/api-contract'
import { getRequestId, logServerEvent } from '../../../../utils/observability'
import { requireUser } from '../../../../utils/require-user'

export default defineEventHandler(async event => {
  const started = Date.now()
  let scanId: string | undefined
  try {
    const { user, supabase } = await requireUser(event)
    scanId = getRouterParam(event, 'id')
    if (!scanId) throw new ApiContractError(400, 'INVALID_REQUEST', 'Scan id is required.')
    const body = await readContractBody(event, acceptPhotoEstimateSchema)
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .select('id, room_id, status')
      .eq('id', scanId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (scanError) throw scanError
    if (!scan) throw new ApiContractError(404, 'NOT_FOUND', 'Scan not found.')

    const { data: measurements, error: measurementError } = await supabase
      .from('measurements')
      .select('measurement_key')
      .eq('scan_id', scanId)
      .eq('user_id', user.id)
    if (measurementError) throw measurementError
    const keys = new Set((measurements ?? []).map(item => item.measurement_key))
    if (!['width', 'length', 'height'].every(key => keys.has(key))) {
      throw new ApiContractError(409, 'CONFLICT', 'All three supported dimensions are required before analysis.')
    }

    const [{ error: roomError }, { error: updateError }] = await Promise.all([
      supabase.from('rooms').update({ name: body.roomName }).eq('id', scan.room_id).eq('user_id', user.id),
      supabase.from('scans').update({
        status: 'ready_for_analysis',
        windows_count: body.windows,
        doors_count: body.doors,
        completed_at: new Date().toISOString()
      }).eq('id', scanId).eq('user_id', user.id)
    ])
    if (roomError) throw roomError
    if (updateError) throw updateError
    logServerEvent(event, { operation: 'photo-estimation.accept', success: true, duration: Date.now() - started, scanId })
    return { accepted: true, requestId: getRequestId(event) }
  } catch (error) {
    logServerEvent(event, { operation: 'photo-estimation.accept', success: false, duration: Date.now() - started, scanId })
    return apiFailure(event, error)
  }
})
