import { ZodError } from 'zod'
import { REQUIRED_CAPTURE_TARGETS } from '~~/shared/capture-analysis'
import { captureMetadataFromEvidenceRow } from '~~/shared/photo-metric'
import { MODEL_VERSIONS } from '~~/shared/model-versions'
import { ApiContractError, apiFailure } from '../../../../utils/api-contract'
import { getRequestId, logServerEvent } from '../../../../utils/observability'
import { requireUser } from '../../../../utils/require-user'
import { getRoomMeasurementProvider } from '../../../../services/photo-metric-provider'

const ACTIVE_RUN_STATUSES = new Set(['processing', 'succeeded', 'partial', 'insufficient'])

const workerUnavailable = (error: unknown) => {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  const starting = name === 'AbortError' || /aborted|timeout|Timeout/i.test(message)
  return new ApiContractError(
    503,
    'SERVICE_UNAVAILABLE',
    starting
      ? 'The GPU worker is still starting. Wait a few seconds and tap Retry.'
      : 'The photo estimator could not accept this job. Wait a moment and retry.'
  )
}

export default defineEventHandler(async event => {
  const started = Date.now()
  let scanId: string | undefined
  try {
    const { user, supabase } = await requireUser(event)
    scanId = getRouterParam(event, 'id')
    if (!scanId) throw new ApiContractError(400, 'INVALID_REQUEST', 'Scan id is required.')
    const provider = getRoomMeasurementProvider()
    const config = useRuntimeConfig()
    if (!provider || !config.inferenceCallbackSecret) {
      throw new ApiContractError(503, 'SERVICE_UNAVAILABLE', 'Photo measurement inference is not configured in this environment.')
    }

    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .select('id, room_id, status, inference_job_id')
      .eq('id', scanId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (scanError) throw scanError
    if (!scan) throw new ApiContractError(404, 'NOT_FOUND', 'Scan not found.')

    if (scan.status === 'processing_geometry' && scan.inference_job_id) {
      const { data: existingRuns } = await supabase
        .from('image_inference_runs')
        .select('status')
        .eq('provider_job_id', scan.inference_job_id)
        .eq('user_id', user.id)
      const accepted = (existingRuns ?? []).some(run => ACTIVE_RUN_STATUSES.has(run.status))
      if (accepted) {
        setResponseStatus(event, 202)
        return { state: scan.status, jobId: scan.inference_job_id, requestId: getRequestId(event) }
      }
      // Queued-only means the previous submit never reached the worker. Fall through and send a new job.
    }

    const { data: evidenceRows, error: evidenceError } = await supabase
      .from('capture_evidence')
      .select('id, capture_id, target_type, storage_path, captured_at, width_px, height_px, orientation, device_family, camera_id_hash, facing_mode, focal_length_35mm, estimated_focal_length_px, brightness_score, sharpness_score, contrast_score, quality_bucket')
      .eq('scan_id', scanId)
      .eq('user_id', user.id)
      .eq('status', 'ready')
      .eq('accepted', true)
      .order('captured_at', { ascending: false })
    if (evidenceError) throw evidenceError

    const latestByTarget = new Map<string, NonNullable<typeof evidenceRows>[number]>()
    for (const row of evidenceRows ?? []) {
      if (!latestByTarget.has(row.target_type)) latestByTarget.set(row.target_type, row)
    }
    const required = REQUIRED_CAPTURE_TARGETS.map(target => latestByTarget.get(target)).filter(Boolean)
    if (required.length !== REQUIRED_CAPTURE_TARGETS.length) {
      throw new ApiContractError(422, 'UNPROCESSABLE', 'The overview, opposite-corner, and floor/ceiling views must all be uploaded before estimation.')
    }
    const selected = [...latestByTarget.values()].slice(0, 8)

    const signedEvidence = await Promise.all(selected.map(async row => {
      const { data, error } = await supabase.storage.from('scan-evidence').createSignedUrl(row!.storage_path, 300)
      if (error || !data?.signedUrl) {
        throw new ApiContractError(503, 'SERVICE_UNAVAILABLE', 'Private photo URLs could not be created for inference.')
      }
      try {
        return { evidenceId: row!.id, signedImageUrl: data.signedUrl, metadata: captureMetadataFromEvidenceRow(row!) }
      } catch (error) {
        if (error instanceof ZodError) {
          throw new ApiContractError(422, 'UNPROCESSABLE', 'Capture metadata could not be used for inference.', error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message
          })))
        }
        throw error
      }
    }))

    const jobId = crypto.randomUUID()
    const siteUrl = String(config.publicSiteUrl || '').replace(/\/$/, '') || getRequestURL(event).origin
    if (!siteUrl.startsWith('https://') && !import.meta.dev) {
      throw new ApiContractError(503, 'SERVICE_UNAVAILABLE', 'A secure public callback URL is required for photo inference.')
    }
    const callbackUrl = `${siteUrl}/api/inference/photo-metric/callback`

    const { error: runError } = await supabase.from('image_inference_runs').insert(selected.map(row => ({
      user_id: user.id,
      scan_id: scanId,
      capture_evidence_id: row!.id,
      provider_job_id: jobId,
      depth_model: 'Apple Depth Pro',
      depth_model_version: MODEL_VERSIONS.depth,
      structure_model: 'Depth structural heuristics',
      structure_model_version: MODEL_VERSIONS.structure,
      geometry_model_version: MODEL_VERSIONS.geometry,
      status: 'queued'
    })))
    if (runError) throw runError

    try {
      await provider.submit({ jobId, scanId, callbackUrl, evidence: signedEvidence })
    } catch (error) {
      await Promise.all([
        supabase.from('image_inference_runs').update({
          status: 'failed',
          error_code: 'SUBMISSION_FAILED',
          error_message: 'The inference worker did not accept the job.',
          completed_at: new Date().toISOString()
        }).eq('provider_job_id', jobId).eq('user_id', user.id),
        supabase.from('scans').update({
          status: 'failed',
          inference_error_code: 'SUBMISSION_FAILED',
          inference_error_message: 'The inference worker did not accept the job.'
        }).eq('id', scanId).eq('user_id', user.id)
      ])
      throw workerUnavailable(error)
    }

    const { error: stateError } = await supabase.from('scans').update({
      status: 'processing_geometry',
      inference_job_id: jobId,
      inference_error_code: null,
      inference_error_message: null,
      measurement_model_version: MODEL_VERSIONS.measurement
    }).eq('id', scanId).eq('user_id', user.id)
    if (stateError) throw stateError

    await supabase.from('image_inference_runs').update({ status: 'processing' })
      .eq('provider_job_id', jobId)
      .eq('user_id', user.id)

    setResponseStatus(event, 202)
    logServerEvent(event, { operation: 'photo-estimation.start', success: true, duration: Date.now() - started, scanId })
    return { state: 'processing_geometry', jobId, requestId: getRequestId(event) }
  } catch (error) {
    logServerEvent(event, {
      operation: 'photo-estimation.start',
      success: false,
      duration: Date.now() - started,
      scanId,
      errorName: error instanceof Error ? error.name : 'unknown',
      errorMessage: error instanceof Error ? error.message.slice(0, 200) : 'unknown'
    })
    return apiFailure(event, error)
  }
})
