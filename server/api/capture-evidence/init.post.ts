import { readContractBody, apiFailure, ApiContractError } from '../../utils/api-contract'
import { requireUser } from '../../utils/require-user'
import { captureEvidenceInitSchema } from '~~/shared/persistence-contracts'
import { MODEL_VERSIONS } from '~~/shared/model-versions'
import { getRequestId, logServerEvent } from '../../utils/observability'

export default defineEventHandler(async (event) => {
  const started = Date.now()
  try {
    const { user, supabase } = await requireUser(event)
    const body = await readContractBody(event, captureEvidenceInitSchema)

    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .select('id, room_id')
      .eq('id', body.scanId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (scanError) throw scanError
    if (!scan) throw new ApiContractError(404, 'NOT_FOUND', 'Scan not found.')

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', body.projectId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (projectError) throw projectError
    if (!project) throw new ApiContractError(404, 'NOT_FOUND', 'Project not found.')

    const evidenceId = crypto.randomUUID()
    const ext = body.mimeType === 'image/png' ? 'png' : body.mimeType === 'image/webp' ? 'webp' : 'jpg'
    const storagePath = `${user.id}/${body.projectId}/${body.scanId}/${evidenceId}.${ext}`

    const { data: evidence, error } = await supabase.from('capture_evidence').insert({
      id: evidenceId,
      user_id: user.id,
      scan_id: body.scanId,
      project_id: body.projectId,
      target_type: body.targetType,
      capture_id: body.captureId,
      storage_path: storagePath,
      status: 'uploading',
      mime_type: body.mimeType,
      width_px: body.widthPx,
      height_px: body.heightPx,
      byte_size: body.byteSize,
      orientation: body.orientation,
      camera_id_hash: body.cameraIdHash ?? null,
      facing_mode: body.facingMode ?? null,
      focal_length_35mm: body.focalLength35mm ?? null,
      estimated_focal_length_px: body.estimatedFocalLengthPx ?? null,
      capture_method: 'camera',
      accepted: false,
      model_version: MODEL_VERSIONS.measurement,
      evidence_origin: 'real_user_verification',
      captured_at: body.capturedAt
    }).select('*').single()
    if (error) throw error

    if (body.relatedMeasurementIds.length) {
      await supabase.from('capture_evidence_measurements').insert(
        body.relatedMeasurementIds.map(measurementId => ({
          capture_evidence_id: evidenceId,
          measurement_id: measurementId,
          relationship_type: 'supports'
        }))
      )
    }

    // Authenticated client uploads directly under RLS (preferred over service-role signed URL).
    logServerEvent(event, {
      operation: 'capture-evidence.init',
      success: true,
      duration: Date.now() - started,
      scanId: body.scanId
    })
    return {
      evidence,
      storagePath,
      bucket: 'scan-evidence',
      uploadMode: 'authenticated_direct',
      requestId: getRequestId(event)
    }
  } catch (error) {
    logServerEvent(event, { operation: 'capture-evidence.init', success: false, duration: Date.now() - started })
    return apiFailure(event, error)
  }
})
