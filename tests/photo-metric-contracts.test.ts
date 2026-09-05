import { describe, expect, it } from 'vitest'
import { inferPhotoEstimationState } from '../shared/photo-estimation-api'
import { captureMetadataFromEvidenceRow, metricDepthResultSchema, photoMetricCallbackSchema } from '../shared/photo-metric'

describe('photo metric contracts', () => {
  it('accepts scalar depth metadata while keeping the depth array out of JSON', () => {
    const result = metricDepthResultSchema.parse({
      evidenceId: 'evidence-1',
      modelName: 'Depth Pro',
      modelVersion: 'depth-pro-0.1-9efe5c1',
      depthMapReference: 'ephemeral://discarded/evidence-1',
      estimatedFocalLengthPx: 1230,
      minDepthMeters: 0.4,
      maxDepthMeters: 8.2,
      processingTimeMs: 420,
      qualityScore: 0.81,
      confidence: 0.78,
      createdAt: '2026-09-03T12:00:00.000Z'
    })
    expect(result.maxDepthMeters).toBe(8.2)
    expect(result).not.toHaveProperty('depthMap')
  })

  it('rejects a signed or public depth artifact URL', () => {
    expect(() => metricDepthResultSchema.parse({
      evidenceId: 'evidence-1',
      modelName: 'Depth Pro',
      modelVersion: 'v1',
      depthMapReference: 'https://storage.example/signed?token=secret',
      estimatedFocalLengthPx: 1000,
      minDepthMeters: 1,
      maxDepthMeters: 5,
      processingTimeMs: 20,
      qualityScore: 0.8,
      confidence: 0.8,
      createdAt: '2026-09-03T12:00:00.000Z'
    })).toThrow()
  })

  it('rejects extra callback fields and unsigned-looking depth URLs already covered by the contract', () => {
    expect(() => photoMetricCallbackSchema.parse({
      jobId: 'a0c26fb1-40a8-44c5-877a-b0775ef93f27',
      scanId: '3e473587-7153-466f-a1e6-58a2cf9cf9d8',
      status: 'succeeded',
      completedAt: '2026-09-03T12:00:00.000Z',
      fabricatedWidthFeet: 12.5
    })).toThrow()
  })

  it('requires an error message for a failed callback', () => {
    expect(() => photoMetricCallbackSchema.parse({
      jobId: 'a0c26fb1-40a8-44c5-877a-b0775ef93f27',
      scanId: '3e473587-7153-466f-a1e6-58a2cf9cf9d8',
      status: 'failed',
      completedAt: '2026-09-03T12:00:00.000Z'
    })).toThrow()
  })
})

describe('capture metadata for inference', () => {
  it('coerces persisted rows so a missing timezone cannot 500 the start route', () => {
    const metadata = captureMetadataFromEvidenceRow({
      id: 'evidence-1',
      capture_id: 'cap-1',
      captured_at: '2026-09-03T19:50:34.000+00:00',
      width_px: 390,
      height_px: 844,
      orientation: null,
      device_family: 'ios-mobile',
      camera_id_hash: 'abc',
      facing_mode: 'environment',
      target_type: 'overview',
      brightness_score: null,
      sharpness_score: 0.8,
      contrast_score: 0.7,
      quality_bucket: null
    })
    expect(metadata.orientation).toBe('portrait')
    expect(metadata.qualityBucket).toBe('usable')
    expect(metadata.cameraIdHash).toBeUndefined()
    expect(metadata.brightnessScore).toBe(0.5)
  })
})

describe('photo estimation status mapping', () => {
  it('keeps a draft scan idle so capture is not skipped', () => {
    expect(inferPhotoEstimationState('draft')).toBe('idle')
    expect(inferPhotoEstimationState('capturing')).toBe('idle')
    expect(inferPhotoEstimationState('analyzing')).toBe('idle')
  })

  it('only reports captured after photos exist, not as a default', () => {
    expect(inferPhotoEstimationState('captured')).toBe('captured')
    expect(inferPhotoEstimationState('processing_geometry')).toBe('processing_geometry')
  })

  it('maps finished scans to analysis-ready when capture can stop', () => {
    expect(inferPhotoEstimationState('estimated', 'stop')).toBe('ready_for_analysis')
    expect(inferPhotoEstimationState('completed')).toBe('ready_for_analysis')
  })
})

