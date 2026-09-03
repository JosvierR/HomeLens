import { readContractBody, apiFailure } from '../../utils/api-contract'
import { requireUser } from '../../utils/require-user'
import { createProjectSchema } from '~~/shared/persistence-contracts'
import { getRequestId, logServerEvent } from '../../utils/observability'

export default defineEventHandler(async (event) => {
  const started = Date.now()
  try {
    const { user, supabase } = await requireUser(event)
    const body = await readContractBody(event, createProjectSchema)
    const { data, error } = await supabase.from('projects').insert({
      user_id: user.id,
      name: body.name,
      status: 'active'
    }).select('*').single()
    if (error) throw error
    logServerEvent(event, { operation: 'projects.create', success: true, duration: Date.now() - started })
    return { project: data, requestId: getRequestId(event) }
  } catch (error) {
    logServerEvent(event, { operation: 'projects.create', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
