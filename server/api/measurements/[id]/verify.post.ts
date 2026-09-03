import { readContractBody, apiFailure, ApiContractError } from '../../../utils/api-contract'
import { requireUser } from '../../../utils/require-user'
import { persistVerifySchema } from '~~/shared/persistence-contracts'
import { calculateHomeLensAnalysis } from '~~/shared/analysis'
import { roomScanSchema } from '~~/shared/decision-confidence'
import { DEFAULT_CALIBRATION_TOLERANCE, recordEvidence } from '~~/shared/calibration'
import { MODEL_VERSIONS, PRODUCTION_EVIDENCE_ORIGIN } from '~~/shared/model-versions'
import { getRequestId, logServerEvent } from '../../../utils/observability'
import { SupabaseEvidenceRepository } from '../../../services/supabase-evidence-repository'

const toDecisionScan = (
  scanRow: Record<string, unknown>,
  roomName: string,
  measurements: Array<Record<string, unknown>>,
  observations: Array<Record<string, unknown>> = []
) => roomScanSchema.parse({
  id: scanRow.id,
  roomId: scanRow.room_id,
  roomName,
  createdAt: scanRow.created_at,
  modelVersion: scanRow.measurement_model_version,
  captureMethod: scanRow.capture_mode,
  windows: Number(scanRow.windows_count ?? 0),
  doors: Number(scanRow.doors_count ?? 0),
  measurements: measurements.map(item => ({
    id: item.measurement_key,
    persistenceId: item.id,
    revision: item.revision,
    label: item.label,
    value: item.accepted_value,
    unit: 'ft',
    confidence: item.source === 'manual' ? 1 : (item.calibrated_confidence ?? item.raw_confidence),
    source: item.source,
    rawConfidence: item.raw_confidence,
    calibratedConfidence: item.calibrated_confidence ?? undefined,
    uncertaintyLow: item.uncertainty_low ?? undefined,
    uncertaintyHigh: item.uncertainty_high ?? undefined,
    provenance: item.measurement_method ? {
      measurementMethod: item.measurement_method,
      depthModelVersion: item.depth_model_version ?? undefined,
      structureModelVersion: item.structure_model_version ?? undefined,
      geometryModelVersion: item.geometry_model_version ?? undefined,
      confidenceModelVersion: item.confidence_model_version ?? undefined,
      supportingEvidenceIds: observations
        .filter(observation => observation.measurement_type === item.measurement_key)
        .map(observation => String(observation.capture_evidence_id)),
      supportingViewCount: Number(item.supporting_view_count ?? 0),
      multiViewConsistency: item.multi_view_consistency ?? undefined,
      rawGeometryConfidence: item.raw_geometry_confidence ?? undefined
    } : undefined,
    originalEstimate: {
      value: item.original_estimate,
      confidence: item.raw_confidence,
      capturedAt: item.created_at,
      uncertaintyLow: item.uncertainty_low ?? undefined,
      uncertaintyHigh: item.uncertainty_high ?? undefined,
      modelVersion: item.model_version ?? undefined,
      supportingEvidenceIds: observations
        .filter(observation => observation.measurement_type === item.measurement_key)
        .map(observation => String(observation.capture_evidence_id))
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

    const { data: observations, error: observationError } = await supabase
      .from('measurement_observations')
      .select('*')
      .eq('scan_id', body.scanId)
      .eq('user_id', user.id)
    if (observationError) throw observationError

    const room = await supabase.from('rooms').select('name').eq('id', scanRow.room_id).maybeSingle()
    const beforeScan = toDecisionScan(scanRow, room.data?.name ?? 'Room', allMeasurements ?? [], observations ?? [])
    const evidenceRepo = new SupabaseEvidenceRepository(supabase)
    const historicalEvidence = await evidenceRepo.listEvidence()
    const beforeAnalysis = calculateHomeLensAnalysis(beforeScan, historicalEvidence)

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
    const afterScan = toDecisionScan(scanRow, room.data?.name ?? 'Room', refreshed, observations ?? [])
    const afterAnalysis = calculateHomeLensAnalysis(afterScan, historicalEvidence)

    const measurementObservations = (observations ?? []).filter(item => item.measurement_type === measurement.measurement_key)
    const supportingEvidenceIds = measurementObservations.map(item => item.capture_evidence_id)
    const { data: captureRows, error: captureError } = supportingEvidenceIds.length
      ? await supabase.from('capture_evidence').select('id, target_type').in('id', supportingEvidenceIds)
      : { data: [], error: null }
    if (captureError) throw captureError
    const average = (values: number[]) => values.length
      ? values.reduce((total, value) => total + value, 0) / values.length
      : null

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
      idempotency_key: body.idempotencyKey,
      depth_confidence: average(measurementObservations.map(item => Number(item.depth_quality))),
      plane_fit_residual: average(measurementObservations.map(item => Number(item.geometry_fit_error))),
      supporting_view_count: measurement.supporting_view_count ?? measurementObservations.length,
      multi_view_disagreement: measurement.multi_view_consistency == null ? null : 1 - Number(measurement.multi_view_consistency),
      image_quality: average(measurementObservations.map(item => Number(item.image_quality))),
      capture_targets: (captureRows ?? []).map(item => item.target_type),
      depth_model_version: measurement.depth_model_version,
      structure_model_version: measurement.structure_model_version,
      geometry_model_version: measurement.geometry_model_version,
      confidence_model_version: measurement.confidence_model_version
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

    const normalizedEvidence = recordEvidence({
      id: evidence.id,
      scanId: body.scanId,
      roomId: String(scanRow.room_id),
      measurementId: String(measurement.measurement_key),
      measurementType: String(measurement.measurement_key),
      estimatedValue: Number(measurement.original_estimate),
      estimatedConfidence: Number(measurement.raw_confidence),
      verifiedValue: body.verifiedValue,
      modelVersion: String(measurement.model_version ?? MODEL_VERSIONS.measurement),
      captureMethod: String(scanRow.capture_mode ?? 'camera'),
      deviceFamily: scanRow.device_family ? String(scanRow.device_family) : undefined,
      verificationSource: 'manual',
      decisionStabilityBefore: beforeAnalysis.decision.bandStability,
      decisionStabilityAfter: afterAnalysis.decision.bandStability,
      createdAt: evidence.created_at
    })

    return {
      scan: afterScan,
      measurement: updated,
      evidence: normalizedEvidence,
      analysis: afterAnalysis,
      requestId: getRequestId(event)
    }
  } catch (error) {
    logServerEvent(event, { operation: 'measurements.verify', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
