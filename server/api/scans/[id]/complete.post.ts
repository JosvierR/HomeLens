import { completeScanSchema } from '~~/shared/persistence-contracts'
import { REQUIRED_CAPTURE_TARGETS } from '~~/shared/capture-analysis'
import { MODEL_VERSIONS } from '~~/shared/model-versions'
import { readContractBody, apiFailure, ApiContractError } from '../../../utils/api-contract'
import { requireUser } from '../../../utils/require-user'
import { getRequestId, logServerEvent } from '../../../utils/observability'

export default defineEventHandler(async event => {
  const started = Date.now()
  try {
    const { user, supabase } = await requireUser(event)
    const scanId = getRouterParam(event, 'id')
    if (!scanId) throw new ApiContractError(400, 'INVALID_REQUEST', 'Scan id is required.')
    const body = await readContractBody(event, completeScanSchema)

    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .select('id, room_id, status, measurement_model_version')
      .eq('id', scanId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (scanError) throw scanError
    if (!scan) throw new ApiContractError(404, 'NOT_FOUND', 'Scan not found.')

    const { data: readyEvidence, error: evidenceError } = await supabase
      .from('capture_evidence')
      .select('target_type')
      .eq('scan_id', scanId)
      .eq('user_id', user.id)
      .eq('status', 'ready')
      .eq('accepted', true)
    if (evidenceError) throw evidenceError
    if ((readyEvidence?.length ?? 0) < body.acceptedFrameCount) {
      throw new ApiContractError(409, 'CONFLICT', 'Not all accepted camera frames are ready in private storage.')
    }
    const readyTargets = new Set((readyEvidence ?? []).map(item => item.target_type))
    if (REQUIRED_CAPTURE_TARGETS.some(target => !readyTargets.has(target))) {
      throw new ApiContractError(409, 'CONFLICT', 'The overview, opposite corner, and ceiling views are all required.')
    }

    const { data: existingMeasurements, error: existingError } = await supabase
      .from('measurements')
      .select('*')
      .eq('scan_id', scanId)
      .eq('user_id', user.id)
    if (existingError) throw existingError
    const existingByKey = new Map((existingMeasurements ?? []).map(item => [item.measurement_key, item]))

    const rows = body.measurements.map(measurement => {
      const existing = existingByKey.get(measurement.key)
      return ({
      user_id: user.id,
      scan_id: scanId,
      measurement_key: measurement.key,
      label: measurement.label,
      accepted_value: measurement.value,
      unit: 'ft',
      source: 'manual',
      original_estimate: existing?.original_estimate ?? measurement.value,
      raw_confidence: existing?.raw_confidence ?? 1,
      calibrated_confidence: null,
      verified_at: new Date().toISOString(),
      verification_source: 'manual',
      model_version: existing?.model_version ?? 'manual-entry-v1',
      measurement_method: existing?.measurement_method ?? 'manual',
      depth_model_version: existing?.depth_model_version ?? null,
      structure_model_version: existing?.structure_model_version ?? null,
      geometry_model_version: existing?.geometry_model_version ?? null,
      confidence_model_version: existing?.confidence_model_version ?? null,
      supporting_view_count: existing?.supporting_view_count ?? null,
      raw_geometry_confidence: existing?.raw_geometry_confidence ?? null,
      multi_view_consistency: existing?.multi_view_consistency ?? null,
      uncertainty_low: existing?.uncertainty_low ?? null,
      uncertainty_high: existing?.uncertainty_high ?? null,
      revision: Number(existing?.revision ?? 0) + 1
    })
    })
    const { data: measurements, error: measurementError } = await supabase
      .from('measurements')
      .upsert(rows, { onConflict: 'scan_id,measurement_key' })
      .select('*')
    if (measurementError) throw measurementError

    const { error: roomError } = await supabase
      .from('rooms')
      .update({ name: body.roomName })
      .eq('id', scan.room_id)
      .eq('user_id', user.id)
    if (roomError) throw roomError

    const completedAt = new Date().toISOString()
    const { data: completedScan, error: completeError } = await supabase
      .from('scans')
      .update({
        status: 'completed',
        completed_at: completedAt,
        windows_count: body.windows,
        doors_count: body.doors,
        accepted_frame_count: body.acceptedFrameCount,
        device_family: body.deviceFamily,
        measurement_model_version: scan.measurement_model_version ?? 'manual-entry-v1',
        decision_model_version: MODEL_VERSIONS.decision
      })
      .eq('id', scanId)
      .eq('user_id', user.id)
      .select('*')
      .single()
    if (completeError) throw completeError

    logServerEvent(event, {
      operation: 'scans.complete',
      success: true,
      duration: Date.now() - started,
      scanId
    })
    return {
      scan: completedScan,
      measurements: measurements ?? [],
      roomName: body.roomName,
      windows: body.windows,
      doors: body.doors,
      requestId: getRequestId(event)
    }
  } catch (error) {
    logServerEvent(event, { operation: 'scans.complete', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
