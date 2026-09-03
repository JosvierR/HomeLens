import { z } from 'zod'
import type { SafeCaptureMetadata } from '~~/shared/photo-metric'

export interface MetricDepthProvider {
  readonly modelName: string
  readonly modelVersion: string
}

export interface RoomStructureProvider {
  readonly modelName: string
  readonly modelVersion: string
}

export interface InferenceEvidenceInput {
  evidenceId: string
  signedImageUrl: string
  metadata: SafeCaptureMetadata
}

export interface PhotoMetricJobRequest {
  jobId: string
  scanId: string
  callbackUrl: string
  evidence: InferenceEvidenceInput[]
}

export interface RoomMeasurementProvider {
  readonly providerName: string
  submit(request: PhotoMetricJobRequest): Promise<{ providerJobId: string }>
}

const acknowledgementSchema = z.object({
  accepted: z.literal(true),
  jobId: z.string().uuid()
}).passthrough()

export class RemotePhotoMetricMeasurementProvider implements RoomMeasurementProvider {
  readonly providerName = 'remote-photo-metric-worker'

  constructor(
    private readonly endpoint: string,
    private readonly bearerToken: string
  ) {}

  async submit(request: PhotoMetricJobRequest) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(`${this.endpoint.replace(/\/$/, '')}/v1/jobs`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.bearerToken}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      })
      if (!response.ok) throw new Error(`Inference worker rejected the job (${response.status}).`)
      const acknowledgement = acknowledgementSchema.parse(await response.json())
      if (acknowledgement.jobId !== request.jobId) throw new Error('Inference worker acknowledged a different job id.')
      return { providerJobId: acknowledgement.jobId }
    } finally {
      clearTimeout(timeout)
    }
  }
}

export const getRoomMeasurementProvider = (): RoomMeasurementProvider | null => {
  const config = useRuntimeConfig()
  const endpoint = String(config.inferenceApiUrl || '')
  const token = String(config.inferenceApiToken || '')
  if (!endpoint || !token) return null
  return new RemotePhotoMetricMeasurementProvider(endpoint, token)
}

