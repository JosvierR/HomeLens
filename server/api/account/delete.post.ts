import { apiFailure, ApiContractError } from '../../utils/api-contract'
import { requireUser } from '../../utils/require-user'
import { createServiceSupabaseClient } from '../../utils/supabase'
import { getRequestId, logServerEvent } from '../../utils/observability'

/**
 * Account deletion — privileged Auth Admin path.
 * Requires SUPABASE_SECRET_KEY. Browser never receives that key.
 */
export default defineEventHandler(async (event) => {
  const started = Date.now()
  try {
    const { user, supabase } = await requireUser(event)
    const admin = createServiceSupabaseClient()
    if (!admin) {
      throw new ApiContractError(
        503,
        'SERVICE_UNAVAILABLE',
        'Account deletion requires a server secret key in this environment.'
      )
    }

    const { data: projects } = await supabase.from('projects').select('id')
    for (const project of projects ?? []) {
      const { data: evidenceRows } = await supabase
        .from('capture_evidence')
        .select('storage_path')
        .eq('project_id', project.id)
      const paths = (evidenceRows ?? []).map((item: { storage_path: string }) => item.storage_path)
      if (paths.length) await supabase.storage.from('scan-evidence').remove(paths)
    }

    await supabase.from('projects').delete().eq('user_id', user.id)
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw error

    logServerEvent(event, {
      operation: 'account.delete',
      success: true,
      duration: Date.now() - started
    })
    return { deleted: true, requestId: getRequestId(event) }
  } catch (error) {
    logServerEvent(event, {
      operation: 'account.delete',
      success: false,
      duration: Date.now() - started
    })
    return apiFailure(event, error)
  }
})
