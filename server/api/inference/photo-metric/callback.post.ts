import { readRawBody } from 'h3'
import { photoMetricCallbackSchema } from '~~/shared/photo-metric'
import { buildPhotoRoomEstimate } from '~~/shared/photo-measurement'
import { MODEL_VERSIONS } from '~~/shared/model-versions'
import { ApiContractError, apiFailure } from '../../../utils/api-contract'
import { verifyInferenceSignature } from '../../../utils/inference-signature'
import { getRequestId, logServerEvent } from '../../../utils/observability'
import { createServiceSupabaseClient } from '../../../utils/supabase'

export default defineEventHandler(async event => {
  const started = Date.now()
  let scanId: string | undefined
  try {
    const config = useRuntimeConfig()
    const rawBody = await readRawBody(event, 'utf8')
    if (!rawBody) throw new ApiContractError(400, 'MALFORMED_JSON', 'A callback body is required.')
    const signature = getHeader(event, 'x-homelens-signature')
    if (!await verifyInferenceSignature(rawBody, signature, String(config.inferenceCallbackSecret || ''))) {
      throw new ApiContractError(401, 'UNAUTHORIZED', 'Invalid inference callback signature.')
    }
    let decoded: unknown
    try {
      decoded = JSON.parse(rawBody)
    } catch {
      throw new ApiContractError(400, 'MALFORMED_JSON', 'Callback body must contain valid JSON.')
    }
    const callback = photoMetricCallbackSchema.parse(decoded)
    scanId = callback.scanId
    const supabase = createServiceSupabaseClient()
    if (!supabase) throw new ApiContractError(503, 'SERVICE_UNAVAILABLE', 'Privileged persistence is not configured.')

    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .select('id, user_id, inference_job_id, status, estimated_at')
      .eq('id', callback.scanId)
      .eq('inference_job_id', callback.jobId)
      .maybeSingle()
    if (scanError) throw scanError
    if (!scan) throw new ApiContractError(404, 'NOT_FOUND', 'Inference job not found.')
    if (scan.estimated_at && ['estimated', 'needs_more_evidence', 'ready_for_analysis', 'failed'].includes(scan.status)) {
      return { accepted: true, state: scan.status, idempotent: true, requestId: getRequestId(event) }
    }

    const completedAt = callback.completedAt
    if (callback.status === 'failed') {
      await Promise.all([
        supabase.from('image_inference_runs').update({
          status: 'failed',
          error_code: callback.errorCode ?? 'INFERENCE_FAILED',
          error_message: callback.errorMessage,
          completed_at: completedAt
        }).eq('provider_job_id', callback.jobId).eq('user_id', scan.user_id),
        supabase.from('scans').update({
          status: 'failed',
          inference_error_code: callback.errorCode ?? 'INFERENCE_FAILED',
          inference_error_message: callback.errorMessage
        }).eq('id', callback.scanId).eq('user_id', scan.user_id)
      ])
      return { accepted: true, state: 'failed', requestId: getRequestId(event) }
    }

    const rectangularityValues = callback.structureObservations.map(item => item.rectangularityConfidence)
    const inferredRectangularity = rectangularityValues.length
      ? rectangularityValues.reduce((total, value) => total + value, 0) / rectangularityValues.length
      : 0
    const rectangularity = callback.status === 'irregular' ? Math.min(0.49, inferredRectangularity) : inferredRectangularity
    const estimate = buildPhotoRoomEstimate(callback.measurementObservations, rectangularity, completedAt)

    const { data: existingMeasurements, error: existingError } = await supabase
      .from('measurements')
      .select('id, measurement_key, source')
      .eq('scan_id', callback.scanId)
      .eq('user_id', scan.user_id)
    if (existingError) throw existingError
    const manualKeys = new Set((existingMeasurements ?? []).filter(item => item.source === 'manual').map(item => item.measurement_key))
    const measurementRows = estimate.measurements
      .filter(measurement => !manualKeys.has(measurement.measurementType))
      .map(measurement => ({
        user_id: scan.user_id,
        scan_id: callback.scanId,
        measurement_key: measurement.measurementType,
        label: measurement.label,
        accepted_value: measurement.valueFeet,
        unit: 'ft',
        source: 'estimated',
        original_estimate: measurement.valueFeet,
        raw_confidence: measurement.confidence,
        calibrated_confidence: null,
        model_version: PHOTO_MODEL_VERSION,
        measurement_method: measurement.measurementMethod,
        depth_model_version: measurement.depthModelVersion,
        structure_model_version: measurement.structureModelVersion,
        geometry_model_version: measurement.geometryModelVersion,
        confidence_model_version: measurement.confidenceModelVersion,
        supporting_view_count: measurement.supportingViewCount,
        raw_geometry_confidence: measurement.rawGeometryConfidence,
        multi_view_consistency: measurement.multiViewConsistency,
        uncertainty_low: measurement.uncertaintyLowFeet,
        uncertainty_high: measurement.uncertaintyHighFeet
      }))
    if (measurementRows.length) {
      const { error } = await supabase.from('measurements').upsert(measurementRows, { onConflict: 'scan_id,measurement_key' })
      if (error) throw error
    }

    const { data: persistedMeasurements, error: persistedError } = await supabase
      .from('measurements')
      .select('id, measurement_key')
      .eq('scan_id', callback.scanId)
      .eq('user_id', scan.user_id)
    if (persistedError) throw persistedError
    const measurementIds = new Map((persistedMeasurements ?? []).map(item => [item.measurement_key, item.id]))

    if (callback.measurementObservations.length) {
      const observationRows = callback.measurementObservations.map(observation => ({
        user_id: scan.user_id,
        scan_id: callback.scanId,
        measurement_id: measurementIds.get(observation.measurementType) ?? null,
        capture_evidence_id: observation.evidenceId,
        measurement_type: observation.measurementType,
        estimated_value: observation.estimatedValueFeet,
        confidence: observation.confidence,
        uncertainty_low: observation.uncertaintyLowFeet,
        uncertainty_high: observation.uncertaintyHighFeet,
        geometry_fit_error: observation.geometryFitErrorMeters,
        depth_quality: observation.signals.depthQuality,
        structural_confidence: observation.signals.structuralConfidence,
        geometry_fit_quality: observation.signals.geometryFitQuality,
        image_quality: observation.signals.imageQuality,
        distance_quality: observation.signals.distanceQuality,
        occlusion_quality: observation.signals.occlusionQuality,
        geometry_completeness: observation.signals.geometryCompleteness,
        model_version: observation.modelVersion,
        created_at: observation.createdAt
      }))
      const { error } = await supabase.from('measurement_observations').upsert(observationRows, {
        onConflict: 'scan_id,capture_evidence_id,measurement_type,model_version'
      })
      if (error) throw error
    }

    await Promise.all(callback.depthResults.map(async depth => {
      const structure = callback.structureObservations.find(item => item.evidenceId === depth.evidenceId)
      const status = callback.status === 'succeeded' ? 'succeeded' : callback.status === 'insufficient' ? 'insufficient' : 'partial'
      const { error } = await supabase.from('image_inference_runs').update({
        status,
        processing_time_ms: depth.processingTimeMs,
        estimated_focal_length_px: depth.estimatedFocalLengthPx,
        min_depth_meters: depth.minDepthMeters,
        max_depth_meters: depth.maxDepthMeters,
        depth_quality: depth.qualityScore,
        structure_quality: structure?.qualityScore ?? null,
        rectangularity_confidence: structure?.rectangularityConfidence ?? null,
        completed_at: completedAt
      }).eq('provider_job_id', callback.jobId).eq('capture_evidence_id', depth.evidenceId).eq('user_id', scan.user_id)
      if (error) throw error
    }))

    const nextState = estimate.status === 'estimated' ? 'estimated' : 'needs_more_evidence'
    const { error: updateError } = await supabase.from('scans').update({
      status: nextState,
      geometry_shape: estimate.shape,
      rectangularity_confidence: estimate.rectangularityConfidence,
      inference_error_code: null,
      inference_error_message: null,
      estimated_at: completedAt,
      measurement_model_version: MODEL_VERSIONS.measurement
    }).eq('id', callback.scanId).eq('user_id', scan.user_id)
    if (updateError) throw updateError

    logServerEvent(event, { operation: 'photo-estimation.callback', success: true, duration: Date.now() - started, scanId })
    return { accepted: true, state: nextState, estimate, requestId: getRequestId(event) }
  } catch (error) {
    logServerEvent(event, { operation: 'photo-estimation.callback', success: false, duration: Date.now() - started, scanId })
    return apiFailure(event, error)
  }
})

const PHOTO_MODEL_VERSION = MODEL_VERSIONS.measurement
