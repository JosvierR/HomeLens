import { describe, expect, it } from 'vitest'
import { backProjectPixel, fitPlaneRansac, parallelPlaneDistance } from '../shared/metric-geometry'
import type { Vector3 } from '../shared/metric-geometry'

describe('metric geometry', () => {
  it('back-projects image pixels with the pinhole camera model', () => {
    expect(backProjectPixel(
      { u: 600, v: 300, depthMeters: 2 },
      { focalLengthPx: 1000, principalPointX: 500, principalPointY: 300 }
    )).toEqual([0.2, 0, 2])
  })

  it('fits a plane and rejects distant furniture-like outliers', () => {
    const floor: Vector3[] = []
    for (let x = -3; x <= 3; x += 1) {
      for (let z = 1; z <= 7; z += 1) floor.push([x, 1.5 + ((x + z) % 2) * 0.003, z])
    }
    floor.push([0, -2, 2], [2, 4, 3], [-4, 6, 1])
    const result = fitPlaneRansac(floor, { distanceThresholdMeters: 0.02, minInliers: 35, kind: 'floor' })
    expect(result).not.toBeNull()
    expect(result!.inlierCount).toBeGreaterThanOrEqual(45)
    expect(result!.residualErrorMeters).toBeLessThan(0.01)
    expect(Math.abs(result!.normal[1])).toBeGreaterThan(0.99)
  })

  it('computes perpendicular distance only for parallel planes', () => {
    expect(parallelPlaneDistance(
      { normal: [0, 1, 0], offset: -1 },
      { normal: [0, -1, 0], offset: 3.7 }
    )).toBeCloseTo(2.7)
    expect(parallelPlaneDistance(
      { normal: [0, 1, 0], offset: -1 },
      { normal: [1, 0, 0], offset: -2 }
    )).toBeNull()
  })
})

