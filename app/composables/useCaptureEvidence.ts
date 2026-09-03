import type { CapturedFrame } from './useCamera'
import type { FrameQualityResult } from '~~/shared/frame-quality'

interface EvidenceInitResponse {
  evidence: { id: string }
  storagePath: string
  bucket: string
}

export const useCaptureEvidence = () => {
  const { getClient } = useSupabase()

  const hashCameraId = async (cameraId?: string) => {
    if (!cameraId || !crypto.subtle) return undefined
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cameraId))
    return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
  }

  const uploadCapture = async (
    frame: CapturedFrame,
    quality: FrameQualityResult,
    context: { scanId: string, projectId: string, deviceFamily: string }
  ) => {
    const cameraIdHash = await hashCameraId(frame.cameraId)
    const initialized = await $fetch<EvidenceInitResponse>('/api/capture-evidence/init', {
      method: 'POST',
      body: {
        captureId: frame.captureId,
        scanId: context.scanId,
        projectId: context.projectId,
        targetType: frame.targetType,
        mimeType: frame.blob.type || 'image/jpeg',
        widthPx: frame.width,
        heightPx: frame.height,
        byteSize: frame.blob.size,
        capturedAt: frame.capturedAt,
        orientation: frame.orientation,
        cameraIdHash,
        facingMode: frame.facingMode,
        estimatedFocalLengthPx: frame.estimatedFocalLengthPx,
        relatedMeasurementIds: []
      }
    })

    const { error: uploadError } = await getClient().storage
      .from(initialized.bucket)
      .upload(initialized.storagePath, frame.blob, {
        cacheControl: '3600',
        contentType: frame.blob.type || 'image/jpeg',
        upsert: false
      })
    if (uploadError) throw uploadError

    await $fetch(`/api/capture-evidence/${initialized.evidence.id}/complete`, {
      method: 'POST',
      body: {
        sharpnessScore: quality.sharpnessScore,
        brightnessScore: quality.brightnessScore,
        contrastScore: quality.contrastScore,
        shadowClipping: frame.shadowClipping,
        highlightClipping: frame.highlightClipping,
        qualityBucket: quality.bucket,
        accepted: quality.bucket !== 'recapture_recommended',
        rejectionReason: quality.reason ?? undefined,
        deviceFamily: context.deviceFamily
      }
    })
    return initialized.evidence.id
  }

  return { uploadCapture }
}
