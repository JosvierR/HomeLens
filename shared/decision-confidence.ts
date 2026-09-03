import { z } from 'zod'

export const measurementSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.number().positive(),
  unit: z.literal('ft'),
  confidence: z.number().min(0).max(1),
  source: z.enum(['estimated', 'manual'])
})

export const roomScanSchema = z.object({
  id: z.string().min(1),
  roomName: z.string().min(1),
  createdAt: z.string().min(1),
  measurements: z.array(measurementSchema).min(3),
  windows: z.number().int().min(0),
  doors: z.number().int().min(0)
})

export type DecisionMeasurement = z.infer<typeof measurementSchema>
export type DecisionRoomScan = z.infer<typeof roomScanSchema>
export type RecommendationBand = 'compact' | 'standard' | 'high-capacity'

export interface VerificationPriority {
  measurementId: string
  label: string
  confidence: number
  impactPercent: number
  priorityScore: number
  reason: string
}

export interface DecisionConfidenceResult {
  baselineIndex: number
  expectedBand: RecommendationBand
  bandStability: number
  stabilityLabel: 'stable' | 'watch' | 'unstable'
  likelyRange: { low: number; high: number }
  bandDistribution: Record<RecommendationBand, number>
  verificationQueue: VerificationPriority[]
  summary: string
}

const getMeasurement = (scan: DecisionRoomScan, id: string) => {
  const measurement = scan.measurements.find(item => item.id === id)
  if (!measurement) throw new Error(`Missing required measurement: ${id}`)
  return measurement
}

const planningIndex = (scan: DecisionRoomScan, overrides: Record<string, number> = {}) => {
  const width = overrides.width ?? getMeasurement(scan, 'width').value
  const length = overrides.length ?? getMeasurement(scan, 'length').value
  const height = overrides.height ?? getMeasurement(scan, 'height').value
  const area = width * length
  const volumeFactor = Math.max(0.75, height / 8)
  return area * volumeFactor + scan.windows * 12 + scan.doors * 8
}

const bandFor = (value: number): RecommendationBand => {
  if (value < 320) return 'compact'
  if (value < 420) return 'standard'
  return 'high-capacity'
}

const uncertaintyFraction = (confidence: number) => 0.01 + (1 - confidence) * 0.28

const deterministicNoise = (sample: number, salt: number) => {
  const x = Math.sin((sample + 1) * (12.9898 + salt * 17.17)) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

export const calculateDecisionConfidence = (input: DecisionRoomScan, sampleCount = 600): DecisionConfidenceResult => {
  const scan = roomScanSchema.parse(input)
  const baselineIndex = planningIndex(scan)
  const expectedBand = bandFor(baselineIndex)
  const samples: number[] = []
  const counts: Record<RecommendationBand, number> = { compact: 0, standard: 0, 'high-capacity': 0 }

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const overrides: Record<string, number> = {}
    scan.measurements.forEach((measurement, index) => {
      const spread = uncertaintyFraction(measurement.confidence)
      const noise = deterministicNoise(sample, index + 1)
      overrides[measurement.id] = measurement.value * (1 + noise * spread)
    })
    const indexValue = planningIndex(scan, overrides)
    samples.push(indexValue)
    counts[bandFor(indexValue)] += 1
  }

  samples.sort((a, b) => a - b)
  const percentile = (p: number) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))]
  const bandStability = counts[expectedBand] / sampleCount

  const verificationQueue = scan.measurements.map(measurement => {
    const spread = uncertaintyFraction(measurement.confidence)
    const lowIndex = planningIndex(scan, { [measurement.id]: measurement.value * (1 - spread) })
    const highIndex = planningIndex(scan, { [measurement.id]: measurement.value * (1 + spread) })
    const impactPercent = Math.abs(highIndex - lowIndex) / Math.max(1, baselineIndex)
    const priorityScore = impactPercent * (1 - measurement.confidence) * 100
    return {
      measurementId: measurement.id,
      label: measurement.label,
      confidence: measurement.confidence,
      impactPercent: impactPercent * 100,
      priorityScore,
      reason: measurement.confidence < 0.75 ? 'Low confidence and meaningful downstream sensitivity.' : impactPercent > 0.08 ? 'High downstream sensitivity even with acceptable confidence.' : 'Lower decision impact than other available measurements.'
    }
  }).sort((a, b) => b.priorityScore - a.priorityScore)

  const stabilityLabel = bandStability >= 0.9 ? 'stable' : bandStability >= 0.72 ? 'watch' : 'unstable'
  const topPriority = verificationQueue[0]

  return {
    baselineIndex: Math.round(baselineIndex),
    expectedBand,
    bandStability,
    stabilityLabel,
    likelyRange: { low: Math.round(percentile(0.05)), high: Math.round(percentile(0.95)) },
    bandDistribution: { compact: counts.compact / sampleCount, standard: counts.standard / sampleCount, 'high-capacity': counts['high-capacity'] / sampleCount },
    verificationQueue,
    summary: topPriority && topPriority.priorityScore > 0.1 ? `Verify ${topPriority.label.toLowerCase()} first; it currently has the highest expected decision impact.` : 'The current recommendation is not highly sensitive to any single measurement.'
  }
}
