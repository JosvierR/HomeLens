import { readContractBody, apiFailure, ApiContractError } from '../../../utils/api-contract'
import { requireUser } from '../../../utils/require-user'
import { persistVerifySchema } from '~~/shared/persistence-contracts'
import { calculateHomeLensAnalysis } from '~~/shared/analysis'
import { roomScanSchema } from '~~/shared/decision-confidence'
import { DEFAULT_CALIBRATION_TOLERANCE } from '~~/shared/calibration'
import { MODEL_VERSIONS, PRODUCTION_EVIDENCE_ORIGIN } from '~~/shared/model-versions'
import { getRequestId, logServerEvent } from '../../../utils/observability'
import { getEvidenceRepository } from '../../../utils/evidence-repository'

const toDecisionScan = (
  scanRow: Record<string, unknown>,
  roomName: string,
  measurements: Array<Record<string, unknown>>
) => roomScanSchema.parse({
  id: scanRow.id,
  roomId: scanRow.room_id,
  roomName,
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
    },
    verification: item.verified_at
      ? {
          verifiedAt: item.verified_at,
          verificationSource: 'manual',
          previousValue: item.original_estimate,
          previousConfidence: item.raw_confidence
        }
      : undefined
  }))
})

export default defineEventHandler(async (event) => {
  const started = Date.now()
  try {
    const { user, supabase } = await requireUser(event)
    const measurementId = getRouterParam(event, 'id')
    if (!measurementId) throw new ApiContractError(400, 'INVALID_REQUEST', 'Measurement id is required.')
    const body = await readContractBody(event, persistVerifySchema)

    const { data: existingEvidence } = await supabase
      .from('verification_evidence')
      .select('*')
      .eq('user_id', user.id)
      .eq('idempotency_key', body.idempotencyKey)
      .maybeSingle()
    if (existingEvidence) {
      return { idempotent: true, evidence: existingEvidence, requestId: getRequestId(event) }
    }

    const { data: measurement, error: measurementError } = await supabase
      .from('measurements')
      .select('*')
      .eq('id', measurementId)
      .eq('user_id', user.id)
      .eq('scan_id', body.scanId)
      .maybeSingle()
    if (measurementError) throw measurementError
    if (!measurement) throw new ApiContractError(404, 'NOT_FOUND', 'Measurement not found.')
    if (body.expectedRevision && body.expectedRevision !== measurement.revision) {
      throw new ApiContractError(409, 'CONFLICT', 'Measurement was updated elsewhere. Refresh and try again.')
    }

    const { data: scanRow, error: scanError } = await supabase
      .from('scans')
      .select('*')
      .eq('id', body.scanId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (scanError) throw scanError
    if (!scanRow) throw new ApiContractError(404, 'NOT_FOUND', 'Scan not found.')

    const { data: allMeasurements, error: listError } = await supabase
      .from('measurements')
      .select('*')
      .eq('scan_id', body.scanId)
    if (listError) throw listError

    const room = await supabase.from('rooms').select('name').eq('id', scanRow.room_id).maybeSingle()
    const beforeScan = toDecisionScan(scanRow, room.data?.name ?? 'Room', allMeasurements ?? [])
    const demoRepo = getEvidenceRepository()
    const beforeAnalysis = calculateHomeLensAnalysis(beforeScan, await demoRepo.listEvidence())

    const previousValue = measurement.accepted_value
    const previousSource = measurement.source
    const verifiedAt = new Date().toISOString()
    const absoluteError = Math.abs(measurement.original_estimate - body.verifiedValue)
    const relativeError = absoluteError / body.verifiedValue
    const withinTolerance = relativeError <= DEFAULT_CALIBRATION_TOLERANCE.relativeError

    const { data: updated, error: updateError } = await supabase
      .from('measurements')
      .update({
        accepted_value: body.verifiedValue,
        source: 'manual',
        calibrated_confidence: null,
        verified_at: verifiedAt,
        verification_source: 'manual',
        revision: measurement.revision + 1
        // original_estimate and raw_confidence intentionally untouched
      })
      .eq('id', measurementId)
      .eq('user_id', user.id)
      .eq('revision', measurement.revision)
      .select('*')
      .maybeSingle()
    if (updateError) throw updateError
    if (!updated) throw new ApiContractError(409, 'CONFLICT', 'Measurement revision conflict.')

    await supabase.from('measurement_revisions').insert({
      user_id: user.id,
      measurement_id: measurementId,
      scan_id: body.scanId,
      previous_value: previousValue,
      new_value: body.verifiedValue,
      previous_source: previousSource,
      new_source: 'manual',
      reason: 'manual_verification',
      verified_by: user.id
    })

    const refreshed = (allMeasurements ?? []).map(item => item.id === measurementId ? updated : item)
    const afterScan = toDecisionScan(scanRow, room.data?.name ?? 'Room', refreshed)
    const afterAnalysis = calculateHomeLensAnalysis(afterScan, await demoRepo.listEvidence())

    const { data: evidence, error: evidenceError } = await supabase.from('verification_evidence').insert({
      user_id: user.id,
      scan_id: body.scanId,
      measurement_id: measurementId,
      measurement_type: measurement.measurement_key,
      estimated_value: measurement.original_estimate,
      verified_value: body.verifiedValue,
      absolute_error: absoluteError,
      relative_error: relativeError,
      raw_confidence: measurement.raw_confidence,
      calibrated_confidence: measurement.calibrated_confidence,
      tolerance_used: DEFAULT_CALIBRATION_TOLERANCE.relativeError,
      within_tolerance: withinTolerance,
      decision_stability_before: beforeAnalysis.decision.bandStability,
      decision_stability_after: afterAnalysis.decision.bandStability,
      stability_gain: afterAnalysis.decision.bandStability - beforeAnalysis.decision.bandStability,
      capture_method: scanRow.capture_mode,
      capture_target: body.captureTarget ?? null,
      quality_bucket: body.qualityBucket ?? null,
      measurement_model_version: MODEL_VERSIONS.measurement,
      decision_model_version: MODEL_VERSIONS.decision,
      calibration_version: MODEL_VERSIONS.calibration,
      evidence_origin: PRODUCTION_EVIDENCE_ORIGIN,
      idempotency_key: body.idempotencyKey
    }).select('*').single()
    if (evidenceError) {
      if (evidenceError.code === '23505') {
        const { data: again } = await supabase
          .from('verification_evidence')
          .select('*')
          .eq('user_id', user.id)
          .eq('idempotency_key', body.idempotencyKey)
          .maybeSingle()
        return { idempotent: true, evidence: again, requestId: getRequestId(event) }
      }
      throw evidenceError
    }

    await supabase.from('analysis_snapshots').insert({
      user_id: user.id,
      scan_id: body.scanId,
      decision_model_version: MODEL_VERSIONS.decision,
      planning_index: afterAnalysis.decision.baselineIndex,
      baseline_band: afterAnalysis.decision.expectedBand,
      band_stability: afterAnalysis.decision.bandStability,
      distribution: afterAnalysis.decision.bandDistribution
    })

    await supabase.from('scans').update({
      status: afterAnalysis.rescue.status === 'stable' ? 'stable' : 'needs_verification'
    }).eq('id', body.scanId).eq('user_id', user.id)

    logServerEvent(event, {
      operation: 'measurements.verify',
      success: true,
      duration: Date.now() - started,
      scanId: body.scanId
    })

    return {
      measurement: updated,
      evidence,
      analysis: afterAnalysis,
      requestId: getRequestId(event)
    }
  } catch (error) {
    logServerEvent(event, { operation: 'measurements.verify', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
