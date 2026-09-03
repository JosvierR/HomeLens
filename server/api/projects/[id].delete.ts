import { apiFailure, ApiContractError } from '../../utils/api-contract'
import { requireUser } from '../../utils/require-user'
import { getRequestId, logServerEvent } from '../../utils/observability'
import { createServiceSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const started = Date.now()
  try {
    const { user, supabase } = await requireUser(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw new ApiContractError(400, 'INVALID_REQUEST', 'Project id is required.')

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error
    if (!project) throw new ApiContractError(404, 'NOT_FOUND', 'Project not found.')

    const { data: evidenceRows } = await supabase
      .from('capture_evidence')
      .select('storage_path')
      .eq('project_id', id)
      .eq('user_id', user.id)

    const paths = (evidenceRows ?? []).map((item: { storage_path: string }) => item.storage_path).filter(Boolean)
    if (paths.length) {
      await supabase.storage.from('scan-evidence').remove(paths)
    }

    // Cascades remove rooms/scans/measurements/evidence via FK on delete.
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (deleteError) throw deleteError

    // Optional privileged refresh hook placeholder (no-op without secret key).
    createServiceSupabaseClient()

    logServerEvent(event, {
      operation: 'projects.delete',
      success: true,
      duration: Date.now() - started
    })
    return { deleted: true, requestId: getRequestId(event) }
  } catch (error) {
    logServerEvent(event, { operation: 'projects.delete', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
