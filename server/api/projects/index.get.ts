import { apiFailure } from '../../utils/api-contract'
import { requireUser } from '../../utils/require-user'
import { getRequestId, logServerEvent } from '../../utils/observability'

export default defineEventHandler(async (event) => {
  const started = Date.now()
  try {
    const { supabase } = await requireUser(event)
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, status, created_at, updated_at')
      .neq('status', 'deleted')
      .order('updated_at', { ascending: false })
    if (error) throw error
    logServerEvent(event, { operation: 'projects.list', success: true, duration: Date.now() - started })
    return { projects: data ?? [], requestId: getRequestId(event) }
  } catch (error) {
    logServerEvent(event, { operation: 'projects.list', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
