import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120)
}).strict()

export const createRoomSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  roomType: z.string().trim().min(1).max(80).optional()
}).strict()

export const createScanSchema = z.object({
  roomId: z.string().uuid(),
  captureMode: z.enum(['camera', 'demo', 'upload']).default('camera')
}).strict()

export const captureEvidenceInitSchema = z.object({
  scanId: z.string().uuid(),
  projectId: z.string().uuid(),
  targetType: z.string().trim().min(1).max(80),
  mimeType: z.enum(['image/jpeg', 'image/webp', 'image/png']),
  widthPx: z.number().int().positive().max(8192),
  heightPx: z.number().int().positive().max(8192),
  byteSize: z.number().int().positive().max(8 * 1024 * 1024),
  relatedMeasurementIds: z.array(z.string().uuid()).max(12).default([])
}).strict()

export const captureEvidenceCompleteSchema = z.object({
  sharpnessScore: z.number().finite().min(0).max(1).optional(),
  brightnessScore: z.number().finite().min(0).max(1).optional(),
  qualityBucket: z.enum(['good', 'usable', 'recapture_recommended']).optional(),
  accepted: z.boolean().default(true),
  rejectionReason: z.string().trim().max(200).optional(),
  deviceFamily: z.string().trim().max(80).optional()
}).strict()

const completedMeasurementSchema = z.object({
  key: z.enum(['width', 'length', 'height']),
  label: z.string().trim().min(1).max(120),
  value: z.number().finite().positive().max(100)
}).strict()

export const completeScanSchema = z.object({
  roomName: z.string().trim().min(1).max(120),
  measurements: z.array(completedMeasurementSchema).length(3).superRefine((measurements, context) => {
    const keys = new Set(measurements.map(measurement => measurement.key))
    for (const key of ['width', 'length', 'height'] as const) {
      if (!keys.has(key)) {
        context.addIssue({ code: 'custom', message: `Missing required measurement: ${key}` })
      }
    }
    if (keys.size !== measurements.length) {
      context.addIssue({ code: 'custom', message: 'Measurement keys must be unique.' })
    }
  }),
  windows: z.number().int().min(0).max(100),
  doors: z.number().int().min(0).max(100),
  deviceFamily: z.string().trim().min(1).max(80),
  acceptedFrameCount: z.number().int().min(3).max(20)
}).strict()

export const persistVerifySchema = z.object({
  scanId: z.string().uuid(),
  measurementId: z.string().uuid(),
  verifiedValue: z.number().finite().positive().max(100),
  expectedRevision: z.number().int().positive().optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
  captureTarget: z.string().trim().max(80).optional(),
  qualityBucket: z.enum(['good', 'usable', 'recapture_recommended']).optional()
}).strict()

export const captureOutcomeSchema = z.object({
  captureActionId: z.string().uuid(),
  captureEvidenceId: z.string().uuid().optional(),
  completed: z.boolean(),
  stabilityBefore: z.number().min(0).max(1),
  stabilityAfter: z.number().min(0).max(1).optional(),
  actualGain: z.number().optional(),
  humanVerificationNeededAfter: z.boolean().optional(),
  elapsedMs: z.number().int().min(0).optional(),
  idempotencyKey: z.string().trim().min(8).max(120)
}).strict()
