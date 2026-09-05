import { apiFailure, ApiContractError } from '../../../utils/api-contract'
import { requireUser } from '../../../utils/require-user'
import { recommendNextBestCapture } from '~~/shared/next-best-capture'
import { recommendScanRescue } from '~~/shared/scan-rescue'
import { roomScanSchema } from '~~/shared/decision-confidence'
import { getRequestId, logServerEvent } from '../../../utils/observability'
import { MODEL_VERSIONS } from '~~/shared/model-versions'

export default defineEventHandler(async (event) => {
  const started = Date.now()
  try {
    const { user, supabase } = await requireUser(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw new ApiContractError(400, 'INVALID_REQUEST', 'Scan id is required.')

    const { data: scanRow, error: scanError } = await supabase
      .from('scans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (scanError) throw scanError
    if (!scanRow) throw new ApiContractError(404, 'NOT_FOUND', 'Scan not found.')

    const { data: measurements, error: measurementError } = await supabase
      .from('measurements')
      .select('*')
      .eq('scan_id', id)
    if (measurementError) throw measurementError
    if (!measurements?.length) {
      throw new ApiContractError(422, 'UNPROCESSABLE', 'Scan has no measurements yet. Camera evidence alone does not invent dimensions.')
    }

    const { data: evidence } = await supabase
      .from('capture_evidence')
      .select('target_type, status')
      .eq('scan_id', id)
      .eq('status', 'ready')

    const { data: policyRows } = await supabase
      .from('capture_policy_profiles')
      .select('target_type, measurement_type, sample_count, reliability_score, completion_rate, mean_actual_gain')
      .eq('policy_version', MODEL_VERSIONS.capturePolicy)

    const room = await supabase.from('rooms').select('name').eq('id', scanRow.room_id).maybeSingle()
    const scan = roomScanSchema.parse({
      id: scanRow.id,
      roomId: scanRow.room_id,
      roomName: room.data?.name ?? 'Room',
      createdAt: scanRow.created_at,
      modelVersion: scanRow.measurement_model_version,
      captureMethod: scanRow.capture_mode,
      windows: 0,
      doors: 0,
      measurements: measurements.map(item => ({
        id: item.measurement_key,
        label: item.label,
        value: item.accepted_value,
        unit: 'ft',
        confidence: item.source === 'manual' ? 1 : (item.calibrated_confidence ?? item.raw_confidence),
        source: item.source,
        rawConfidence: item.raw_confidence,
        calibratedConfidence: item.calibrated_confidence ?? undefined,
        originalEstimate: {
          value: item.original_estimate,
          confidence: item.raw_confidence,
          capturedAt: item.created_at
        }
      }))
    })

    const rescue = recommendScanRescue(scan)
    const next = recommendNextBestCapture(scan, rescue, {
      existingTargets: (evidence ?? []).map(item => item.target_type),
      policyReliability: (policyRows ?? []).map(item => ({
        targetType: item.target_type,
        measurementType: item.measurement_type ?? undefined,
        sampleCount: item.sample_count,
        reliabilityScore: item.reliability_score ?? 0.7,
        completionRate: item.completion_rate ?? 0,
        meanActualGain: item.mean_actual_gain
      }))
    })

    let persistedAction = null
    if (next.kind === 'capture') {
      const related = measurements.find(item => item.measurement_key === next.relatedMeasurementIds[0])
      const { data: action } = await supabase.from('capture_actions').insert({
        user_id: user.id,
        scan_id: id,
        target_type: next.targetType,
        related_measurement_id: related?.id ?? null,
        instruction: next.instruction,
        reason: next.reason,
        stability_before: next.currentStability,
        projected_stability_after: next.projectedStability,
        projected_gain: next.expectedGain,
        estimated_effort: next.estimatedEffort,
        historical_reliability: next.historicalReliability,
        utility_score: next.utilityScore,
        policy_version: next.policyVersion
      }).select('*').single()
      persistedAction = action
    }

    logServerEvent(event, {
      operation: 'scans.next-capture',
      success: true,
      duration: Date.now() - started,
      scanId: id
    })
    return {
      next,
      captureAction: persistedAction,
      rescue,
      requestId: getRequestId(event)
    }
  } catch (error) {
    logServerEvent(event, { operation: 'scans.next-capture', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
