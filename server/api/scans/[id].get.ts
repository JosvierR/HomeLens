import { apiFailure, ApiContractError } from '../../utils/api-contract'
import { requireUser } from '../../utils/require-user'
import { getRequestId, logServerEvent } from '../../utils/observability'

export default defineEventHandler(async (event) => {
  const started = Date.now()
  try {
    const { user, supabase } = await requireUser(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw new ApiContractError(400, 'INVALID_REQUEST', 'Scan id is required.')

    const { data: scan, error } = await supabase
      .from('scans')
      .select('*, rooms(name, room_type, project_id)')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error
    if (!scan) throw new ApiContractError(404, 'NOT_FOUND', 'Scan not found.')

    const [{ data: measurements }, { data: evidence }, { data: snapshots }, { data: actions }] = await Promise.all([
      supabase.from('measurements').select('*').eq('scan_id', id).order('created_at', { ascending: true }),
      supabase.from('capture_evidence').select('id, target_type, status, quality_bucket, accepted, captured_at, storage_path').eq('scan_id', id),
      supabase.from('analysis_snapshots').select('*').eq('scan_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('capture_actions').select('*').eq('scan_id', id).order('created_at', { ascending: false }).limit(20)
    ])

    logServerEvent(event, { operation: 'scans.get', success: true, duration: Date.now() - started, scanId: id })
    return {
      scan,
      measurements: measurements ?? [],
      captureEvidence: evidence ?? [],
      analysisSnapshots: snapshots ?? [],
      captureActions: actions ?? [],
      requestId: getRequestId(event)
    }
  } catch (error) {
    logServerEvent(event, { operation: 'scans.get', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
