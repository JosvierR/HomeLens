import type { CalibrationContext, MeasurementEvidence } from './calibration'
import { measurementEvidenceSchema } from './calibration'

export interface EvidenceRepository {
  listEvidence(): Promise<MeasurementEvidence[]>
  addEvidence(evidence: MeasurementEvidence): Promise<void>
  findComparableEvidence(context: CalibrationContext): Promise<MeasurementEvidence[]>
}

const matchesContext = (evidence: MeasurementEvidence, context: CalibrationContext) => {
  if (context.measurementType && evidence.measurementType !== context.measurementType) return false
  if (context.modelVersion && evidence.modelVersion !== context.modelVersion) return false
  if (context.captureMethod && evidence.captureMethod !== context.captureMethod) return false
  if (context.deviceFamily && evidence.deviceFamily !== context.deviceFamily) return false
  if (context.roomCategory && evidence.roomCategory !== context.roomCategory) return false
  return true
}

export class InMemoryEvidenceRepository implements EvidenceRepository {
  private readonly records: MeasurementEvidence[]

  constructor(initialEvidence: readonly MeasurementEvidence[] = []) {
    this.records = initialEvidence.map(item => measurementEvidenceSchema.parse(structuredClone(item)))
  }

  async listEvidence() {
    return structuredClone(this.records)
  }

  async addEvidence(evidence: MeasurementEvidence) {
    const parsed = measurementEvidenceSchema.parse(evidence)
    if (this.records.some(item => item.id === parsed.id)) {
      throw new Error(`Evidence id already exists: ${parsed.id}`)
    }
    this.records.push(structuredClone(parsed))
  }

  async findComparableEvidence(context: CalibrationContext) {
    return structuredClone(this.records.filter(item => matchesContext(item, context)))
  }
}
