import { readContractBody, apiFailure } from '../../utils/api-contract'
import { requireUser } from '../../utils/require-user'
import { captureOutcomeSchema } from '~~/shared/persistence-contracts'
import { getRequestId, logServerEvent } from '../../utils/observability'

export default defineEventHandler(async (event) => {
  const started = Date.now()
  try {
    const { user, supabase } = await requireUser(event)
    const body = await readContractBody(event, captureOutcomeSchema)

    const { data: existing } = await supabase
      .from('capture_outcomes')
      .select('*')
      .eq('user_id', user.id)
      .eq('idempotency_key', body.idempotencyKey)
      .maybeSingle()
    if (existing) return { idempotent: true, outcome: existing, requestId: getRequestId(event) }

    const { data, error } = await supabase.from('capture_outcomes').insert({
      user_id: user.id,
      capture_action_id: body.captureActionId,
      capture_evidence_id: body.captureEvidenceId ?? null,
      completed: body.completed,
      stability_before: body.stabilityBefore,
      stability_after: body.stabilityAfter ?? null,
      actual_gain: body.actualGain ?? null,
      human_verification_needed_after: body.humanVerificationNeededAfter ?? null,
      elapsed_ms: body.elapsedMs ?? null,
      idempotency_key: body.idempotencyKey
    }).select('*').single()
    if (error) throw error

    logServerEvent(event, {
      operation: 'capture-outcomes.create',
      success: true,
      duration: Date.now() - started
    })
    return { outcome: data, requestId: getRequestId(event) }
  } catch (error) {
    logServerEvent(event, { operation: 'capture-outcomes.create', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
