import type { DecisionRoomScan } from '~~/shared/decision-confidence'
import { calculateHomeLensAnalysis } from '~~/shared/analysis'
import { recommendNextBestCapture } from '~~/shared/next-best-capture'
import { buildPhotoRoomEstimate } from '~~/shared/photo-measurement'
import type { MeasurementObservation } from '~~/shared/photo-metric'
import type { PhotoEstimationStatusResponse } from '~~/shared/photo-estimation-api'
import { SupabaseEvidenceRepository } from '../../../../services/supabase-evidence-repository'
import { ApiContractError, apiFailure } from '../../../../utils/api-contract'
import { getRequestId, logServerEvent } from '../../../../utils/observability'
import { requireUser } from '../../../../utils/require-user'

export default defineEventHandler(async event => {
  const started = Date.now()
  let scanId: string | undefined
  try {
    const { user, supabase } = await requireUser(event)
    scanId = getRouterParam(event, 'id')
    if (!scanId) throw new ApiContractError(400, 'INVALID_REQUEST', 'Scan id is required.')

    const { data: scanRow, error: scanError } = await supabase
      .from('scans')
      .select('*, rooms(name, room_type)')
      .eq('id', scanId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (scanError) throw scanError
    if (!scanRow) throw new ApiContractError(404, 'NOT_FOUND', 'Scan not found.')

    const [measurementResult, observationResult, runResult, evidenceResult] = await Promise.all([
      supabase.from('measurements').select('*').eq('scan_id', scanId).eq('user_id', user.id),
      supabase.from('measurement_observations').select('*').eq('scan_id', scanId).eq('user_id', user.id),
      supabase.from('image_inference_runs').select('*').eq('scan_id', scanId).eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('capture_evidence').select('id, target_type, status, accepted').eq('scan_id', scanId).eq('user_id', user.id)
    ])
    if (measurementResult.error) throw measurementResult.error
    if (observationResult.error) throw observationResult.error
    if (runResult.error) throw runResult.error
    if (evidenceResult.error) throw evidenceResult.error

    const observations: MeasurementObservation[] = (observationResult.data ?? []).map(row => ({
      evidenceId: row.capture_evidence_id,
      measurementType: row.measurement_type,
      estimatedValueFeet: row.estimated_value,
      confidence: row.confidence,
      uncertaintyLowFeet: row.uncertainty_low,
      uncertaintyHighFeet: row.uncertainty_high,
      geometryFitErrorMeters: row.geometry_fit_error,
      signals: {
        depthQuality: row.depth_quality,
        structuralConfidence: row.structural_confidence,
        geometryFitQuality: row.geometry_fit_quality,
        imageQuality: row.image_quality,
        distanceQuality: row.distance_quality,
        occlusionQuality: row.occlusion_quality,
        geometryCompleteness: row.geometry_completeness
      },
      modelVersion: row.model_version,
      createdAt: row.created_at
    }))
    const estimate = observations.length
      ? buildPhotoRoomEstimate(observations, Number(scanRow.rectangularity_confidence ?? 0), scanRow.estimated_at ?? new Date().toISOString())
      : null

    const rooms = scanRow.rooms
    const room = Array.isArray(rooms) ? rooms[0] : rooms
    const measurementRows = measurementResult.data ?? []
    const required = new Set(measurementRows.map(row => row.measurement_key))
    let scan: DecisionRoomScan | null = null
    let analysis = null
    let nextCapture = null
    if (['width', 'length', 'height'].every(key => required.has(key))) {
      scan = {
        id: scanRow.id,
        roomId: scanRow.room_id,
        roomName: room?.name ?? 'Estimated room',
        createdAt: scanRow.created_at,
        windows: Number(scanRow.windows_count ?? 0),
        doors: Number(scanRow.doors_count ?? 0),
        modelVersion: scanRow.measurement_model_version,
        captureMethod: 'camera',
        deviceFamily: scanRow.device_family ?? 'web-camera',
        roomCategory: room?.room_type ?? 'room',
        measurements: measurementRows
          .filter(row => ['width', 'length', 'height'].includes(row.measurement_key))
          .map(row => {
            const supporting = observations.filter(item => item.measurementType === row.measurement_key).map(item => item.evidenceId)
            const rawConfidence = Number(row.raw_confidence)
            return {
              id: row.measurement_key,
              persistenceId: row.id,
              revision: Number(row.revision),
              label: row.label,
              value: Number(row.accepted_value),
              unit: 'ft' as const,
              confidence: Number(row.calibrated_confidence ?? rawConfidence),
              rawConfidence,
              calibratedConfidence: row.calibrated_confidence ?? undefined,
              source: row.source === 'manual' ? 'manual' as const : 'estimated' as const,
              uncertaintyLow: row.uncertainty_low ?? undefined,
              uncertaintyHigh: row.uncertainty_high ?? undefined,
              provenance: row.measurement_method ? {
                measurementMethod: row.measurement_method,
                depthModelVersion: row.depth_model_version ?? undefined,
                structureModelVersion: row.structure_model_version ?? undefined,
                geometryModelVersion: row.geometry_model_version ?? undefined,
                confidenceModelVersion: row.confidence_model_version ?? undefined,
                supportingEvidenceIds: supporting,
                supportingViewCount: Number(row.supporting_view_count ?? supporting.length),
                multiViewConsistency: row.multi_view_consistency ?? undefined,
                rawGeometryConfidence: row.raw_geometry_confidence ?? undefined
              } : undefined,
              originalEstimate: {
                value: Number(row.original_estimate),
                confidence: rawConfidence,
                capturedAt: row.created_at,
                uncertaintyLow: row.uncertainty_low ?? undefined,
                uncertaintyHigh: row.uncertainty_high ?? undefined,
                modelVersion: row.model_version,
                supportingEvidenceIds: supporting
              }
            }
          })
      }
      const evidence = await new SupabaseEvidenceRepository(supabase).listEvidence().catch(() => [])
      analysis = calculateHomeLensAnalysis(scan, evidence)
      nextCapture = recommendNextBestCapture(scan, analysis.rescue, {
        existingTargets: (evidenceResult.data ?? []).filter(item => item.status === 'ready' && item.accepted).map(item => item.target_type)
      })
    }

    const runs = runResult.data ?? []
    const completed = runs.filter(run => ['succeeded', 'partial', 'insufficient', 'failed'].includes(run.status)).length
    const inferredState: PhotoEstimationStatusResponse['state'] = scanRow.status === 'estimated' && nextCapture?.kind === 'stop'
      ? 'ready_for_analysis'
      : ['captured', 'processing_geometry', 'estimated', 'needs_more_evidence', 'ready_for_analysis', 'failed'].includes(scanRow.status)
        ? scanRow.status
        : scanRow.status === 'stable' || scanRow.status === 'completed'
          ? 'ready_for_analysis'
          : 'captured'
    const response: PhotoEstimationStatusResponse = {
      state: inferredState,
      jobId: scanRow.inference_job_id ?? null,
      progress: { completed, total: runs.length },
      estimate,
      scan,
      analysis,
      nextCapture,
      error: scanRow.status === 'failed' ? {
        code: scanRow.inference_error_code ?? 'INFERENCE_FAILED',
        message: scanRow.inference_error_message ?? 'Photo estimation could not be completed.'
      } : null,
      requestId: getRequestId(event)
    }
    logServerEvent(event, { operation: 'photo-estimation.status', success: true, duration: Date.now() - started, scanId })
    return response
  } catch (error) {
    logServerEvent(event, { operation: 'photo-estimation.status', success: false, duration: Date.now() - started, scanId })
    return apiFailure(event, error)
  }
})
