import { apiFailure, ApiContractError } from '../../../utils/api-contract'
import { requireUser } from '../../../utils/require-user'
import { getRequestId, logServerEvent } from '../../../utils/observability'

export default defineEventHandler(async (event) => {
  const started = Date.now()
  try {
    const { user, supabase } = await requireUser(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw new ApiContractError(400, 'INVALID_REQUEST', 'Project id is required.')

    const { data: project, error } = await supabase
      .from('projects')
      .select('id, name, status, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error
    if (!project) throw new ApiContractError(404, 'NOT_FOUND', 'Project not found.')

    const { data: rooms } = await supabase.from('rooms').select('*').eq('project_id', id)
    const roomIds = (rooms ?? []).map(item => item.id)
    const { data: scans } = roomIds.length
      ? await supabase.from('scans').select('*').in('room_id', roomIds)
      : { data: [] as Array<Record<string, unknown>> }
    const scanIds = (scans ?? []).map(item => item.id as string)
    const { data: measurements } = scanIds.length
      ? await supabase.from('measurements').select('*').in('scan_id', scanIds)
      : { data: [] as Array<Record<string, unknown>> }
    const { data: revisions } = scanIds.length
      ? await supabase.from('measurement_revisions').select('*').in('scan_id', scanIds)
      : { data: [] as Array<Record<string, unknown>> }
    const { data: verification } = scanIds.length
      ? await supabase.from('verification_evidence').select('*').in('scan_id', scanIds)
      : { data: [] as Array<Record<string, unknown>> }

    logServerEvent(event, {
      operation: 'projects.export',
      success: true,
      duration: Date.now() - started
    })

    return {
      exportedAt: new Date().toISOString(),
      project,
      rooms: rooms ?? [],
      scans: scans ?? [],
      measurements: measurements ?? [],
      measurementRevisions: revisions ?? [],
      verificationEvidence: verification ?? [],
      requestId: getRequestId(event)
    }
  } catch (error) {
    logServerEvent(event, { operation: 'projects.export', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
