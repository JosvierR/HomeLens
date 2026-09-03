import type { SupabaseClient } from '@supabase/supabase-js'
import type { CalibrationContext, MeasurementEvidence } from '~~/shared/calibration'
import { measurementEvidenceSchema } from '~~/shared/calibration'
import type { EvidenceRepository } from '~~/shared/evidence-repository'
import { PRODUCTION_EVIDENCE_ORIGIN } from '~~/shared/model-versions'

const mapRow = (row: Record<string, unknown>): MeasurementEvidence => measurementEvidenceSchema.parse({
  id: row.id,
  scanId: row.scan_id,
  roomId: row.scan_id,
  measurementId: row.measurement_id,
  measurementType: row.measurement_type,
  estimatedValue: row.estimated_value,
  estimatedConfidence: row.raw_confidence,
  verifiedValue: row.verified_value,
  absoluteError: row.absolute_error,
  relativeError: row.relative_error,
  modelVersion: row.measurement_model_version,
  captureMethod: row.capture_method ?? undefined,
  deviceFamily: row.device_family ?? undefined,
  roomCategory: undefined,
  verificationSource: 'manual',
  decisionStabilityBefore: row.decision_stability_before,
  decisionStabilityAfter: row.decision_stability_after,
  stabilityGain: row.stability_gain,
  createdAt: row.created_at,
  demo: row.evidence_origin === 'synthetic_demo'
})

export class SupabaseEvidenceRepository implements EvidenceRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly origin: string = PRODUCTION_EVIDENCE_ORIGIN
  ) {}

  async listEvidence() {
    const { data, error } = await this.supabase
      .from('verification_evidence')
      .select('*')
      .eq('evidence_origin', this.origin)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) throw error
    return (data ?? []).map(row => mapRow(row as Record<string, unknown>))
  }

  async addEvidence(evidence: MeasurementEvidence) {
    const parsed = measurementEvidenceSchema.parse(evidence)
    const { error } = await this.supabase.from('verification_evidence').insert({
      id: parsed.id,
      user_id: (await this.supabase.auth.getUser()).data.user?.id,
      scan_id: parsed.scanId,
      measurement_id: parsed.measurementId,
      measurement_type: parsed.measurementType,
      estimated_value: parsed.estimatedValue,
      verified_value: parsed.verifiedValue,
      absolute_error: parsed.absoluteError,
      relative_error: parsed.relativeError,
      raw_confidence: parsed.estimatedConfidence,
      calibrated_confidence: null,
      tolerance_used: 0.03,
      within_tolerance: parsed.relativeError <= 0.03,
      decision_stability_before: parsed.decisionStabilityBefore,
      decision_stability_after: parsed.decisionStabilityAfter,
      stability_gain: parsed.stabilityGain,
      capture_method: parsed.captureMethod ?? null,
      device_family: parsed.deviceFamily ?? null,
      measurement_model_version: parsed.modelVersion ?? 'geometry-v1',
      decision_model_version: 'decision-v1',
      calibration_version: 'calibration-v1',
      evidence_origin: parsed.demo ? 'synthetic_demo' : PRODUCTION_EVIDENCE_ORIGIN,
      created_at: parsed.createdAt
    })
    if (error) throw error
  }

  async findComparableEvidence(context: CalibrationContext) {
    let query = this.supabase
      .from('verification_evidence')
      .select('*')
      .eq('evidence_origin', this.origin)
      .limit(200)

    if (context.measurementType) query = query.eq('measurement_type', context.measurementType)
    if (context.modelVersion) query = query.eq('measurement_model_version', context.modelVersion)
    if (context.captureMethod) query = query.eq('capture_method', context.captureMethod)
    if (context.deviceFamily) query = query.eq('device_family', context.deviceFamily)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map(row => mapRow(row as Record<string, unknown>))
  }
}
