import type { HomeLensAnalysisResult } from './analysis'
import type { DecisionRoomScan } from './decision-confidence'
import type { NextBestCaptureResult } from './next-best-capture'
import type { PhotoRoomEstimate } from './photo-metric'
import { z } from 'zod'

export const acceptPhotoEstimateSchema = z.object({
  roomName: z.string().trim().min(1).max(120),
  windows: z.number().int().min(0).max(100),
  doors: z.number().int().min(0).max(100)
}).strict()

export type PhotoEstimationState =
  | 'captured'
  | 'processing_geometry'
  | 'estimated'
  | 'needs_more_evidence'
  | 'ready_for_analysis'
  | 'failed'

export interface PhotoEstimationStatusResponse {
  state: PhotoEstimationState
  jobId: string | null
  progress: { completed: number, total: number }
  estimate: PhotoRoomEstimate | null
  scan: DecisionRoomScan | null
  analysis: HomeLensAnalysisResult | null
  nextCapture: NextBestCaptureResult | null
  error: { code: string, message: string } | null
  requestId?: string
}
