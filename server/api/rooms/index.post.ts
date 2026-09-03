import { readContractBody, apiFailure } from '../../utils/api-contract'
import { requireUser } from '../../utils/require-user'
import { createRoomSchema } from '~~/shared/persistence-contracts'
import { ApiContractError } from '../../utils/api-contract'
import { getRequestId, logServerEvent } from '../../utils/observability'

export default defineEventHandler(async (event) => {
  const started = Date.now()
  try {
    const { user, supabase } = await requireUser(event)
    const body = await readContractBody(event, createRoomSchema)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', body.projectId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (projectError) throw projectError
    if (!project) throw new ApiContractError(404, 'NOT_FOUND', 'Project not found.')

    const { data, error } = await supabase.from('rooms').insert({
      user_id: user.id,
      project_id: body.projectId,
      name: body.name,
      room_type: body.roomType ?? null
    }).select('*').single()
    if (error) throw error
    logServerEvent(event, { operation: 'rooms.create', success: true, duration: Date.now() - started })
    return { room: data, requestId: getRequestId(event) }
  } catch (error) {
    logServerEvent(event, { operation: 'rooms.create', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
