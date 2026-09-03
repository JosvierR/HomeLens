import type { PlaneEstimate } from './photo-metric'

export type Vector3 = [number, number, number]

export interface CameraIntrinsics {
  focalLengthPx: number
  principalPointX: number
  principalPointY: number
}

export interface DepthPixel {
  u: number
  v: number
  depthMeters: number
}

export interface RansacOptions {
  iterations?: number
  distanceThresholdMeters?: number
  minInliers?: number
  evidenceId?: string
  kind?: PlaneEstimate['kind']
  modelVersion?: string
}

const subtract = (a: Vector3, b: Vector3): Vector3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vector3, b: Vector3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vector3, b: Vector3): Vector3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
]
const magnitude = (value: Vector3) => Math.sqrt(dot(value, value))
const normalize = (value: Vector3): Vector3 | null => {
  const length = magnitude(value)
  if (!Number.isFinite(length) || length < 1e-9) return null
  return [value[0] / length, value[1] / length, value[2] / length]
}

export const backProjectPixel = (pixel: DepthPixel, intrinsics: CameraIntrinsics): Vector3 => {
  if (!Number.isFinite(pixel.depthMeters) || pixel.depthMeters <= 0) throw new Error('Depth must be a positive finite value.')
  if (!Number.isFinite(intrinsics.focalLengthPx) || intrinsics.focalLengthPx <= 0) throw new Error('Focal length must be positive.')
  return [
    ((pixel.u - intrinsics.principalPointX) * pixel.depthMeters) / intrinsics.focalLengthPx,
    ((pixel.v - intrinsics.principalPointY) * pixel.depthMeters) / intrinsics.focalLengthPx,
    pixel.depthMeters
  ]
}

const planeFromPoints = (a: Vector3, b: Vector3, c: Vector3) => {
  const normal = normalize(cross(subtract(b, a), subtract(c, a)))
  if (!normal) return null
  return { normal, offset: -dot(normal, a) }
}

export const pointPlaneDistance = (point: Vector3, plane: { normal: Vector3, offset: number }) =>
  Math.abs(dot(point, plane.normal) + plane.offset)

/** Deterministic RANSAC so the same stored observations remain reproducible. */
export const fitPlaneRansac = (points: readonly Vector3[], options: RansacOptions = {}): PlaneEstimate | null => {
  if (points.length < 3) return null
  const iterations = Math.max(1, Math.floor(options.iterations ?? 160))
  const threshold = options.distanceThresholdMeters ?? 0.04
  const minInliers = Math.max(3, options.minInliers ?? Math.ceil(points.length * 0.35))
  let seed = (points.length * 2654435761) >>> 0
  const randomIndex = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed % points.length
  }
  let best: { normal: Vector3, offset: number, indices: number[], residual: number } | null = null

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const a = randomIndex()
    let b = randomIndex()
    let c = randomIndex()
    if (b === a) b = (b + 1) % points.length
    if (c === a || c === b) c = (c + 2) % points.length
    if (c === a || c === b) continue
    const plane = planeFromPoints(points[a]!, points[b]!, points[c]!)
    if (!plane) continue
    const indices: number[] = []
    let residual = 0
    points.forEach((point, index) => {
      const distance = pointPlaneDistance(point, plane)
      if (distance <= threshold) {
        indices.push(index)
        residual += distance
      }
    })
    if (indices.length < minInliers) continue
    const meanResidual = residual / indices.length
    if (!best || indices.length > best.indices.length || (indices.length === best.indices.length && meanResidual < best.residual)) {
      best = { ...plane, indices, residual: meanResidual }
    }
  }

  if (!best) return null
  const inlierRatio = best.indices.length / points.length
  const residualQuality = Math.max(0, 1 - best.residual / Math.max(threshold, 1e-6))
  return {
    evidenceId: options.evidenceId ?? 'local-observation',
    kind: options.kind ?? 'unknown_wall',
    normal: best.normal,
    offset: best.offset,
    inlierCount: best.indices.length,
    residualErrorMeters: best.residual,
    confidence: Math.min(1, Math.max(0, inlierRatio * 0.7 + residualQuality * 0.3)),
    modelVersion: options.modelVersion ?? 'ransac-room-geometry-v1'
  }
}

export const parallelPlaneDistance = (
  first: Pick<PlaneEstimate, 'normal' | 'offset'>,
  second: Pick<PlaneEstimate, 'normal' | 'offset'>,
  minimumParallelCosine = 0.96
) => {
  const firstNormal = normalize(first.normal)
  const secondNormal = normalize(second.normal)
  if (!firstNormal || !secondNormal) return null
  const alignment = dot(firstNormal, secondNormal)
  if (Math.abs(alignment) < minimumParallelCosine) return null
  const alignedOffset = alignment < 0 ? -second.offset : second.offset
  return Math.abs(first.offset - alignedOffset)
}

