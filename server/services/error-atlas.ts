import type { CalibrationContext, CalibratedConfidenceSuggestion, MeasurementEvidence } from '~~/shared/calibration'
import { suggestCalibratedConfidence, calculateCalibrationSummary } from '~~/shared/calibration'
import { DEFAULT_CALIBRATION_MINIMUMS } from '~~/shared/calibration'
import type { CapturePolicyReliability } from '~~/shared/next-best-capture'
import { PRODUCTION_EVIDENCE_ORIGIN } from '~~/shared/model-versions'

export interface ErrorAtlasContext {
  comparableCount: number
  calibrated?: CalibratedConfidenceSuggestion
  summarySampleCount: number
  captureReliability: CapturePolicyReliability[]
  explanation: string
}

export interface ErrorAtlasDeps {
  listVerificationEvidence: () => Promise<MeasurementEvidence[]>
  listCapturePolicyProfiles?: () => Promise<CapturePolicyReliability[]>
}

/**
 * Error Atlas service — explainable aggregates over verification + capture outcomes.
 * Does not expose other users' private imagery or row-level PII.
 */
export const createErrorAtlas = (deps: ErrorAtlasDeps) => {
  const findComparable = async (context: CalibrationContext) => {
    const all = await deps.listVerificationEvidence()
    return all.filter(item => {
      if (item.demo) return false
      if (context.measurementType && item.measurementType !== context.measurementType) return false
      if (context.modelVersion && item.modelVersion !== context.modelVersion) return false
      if (context.captureMethod && item.captureMethod !== context.captureMethod) return false
      if (context.deviceFamily && item.deviceFamily !== context.deviceFamily) return false
      if (context.roomCategory && item.roomCategory !== context.roomCategory) return false
      return true
    })
  }

  const explainCalibration = async (
    rawConfidence: number,
    context: CalibrationContext
  ): Promise<ErrorAtlasContext> => {
    const evidence = await deps.listVerificationEvidence()
    const realEvidence = evidence.filter(item => !item.demo)
    const suggestion = suggestCalibratedConfidence(rawConfidence, realEvidence, context, {
      minimums: {
        ...DEFAULT_CALIBRATION_MINIMUMS,
        exactContext: 25,
        measurementType: 20,
        global: 30
      }
    })
    const comparable = await findComparable(context)
    const summary = calculateCalibrationSummary(comparable)
    const captureReliability = (await deps.listCapturePolicyProfiles?.()) ?? []

    let explanation = 'Not enough comparable history yet. Using model confidence.'
    if (suggestion.applied) {
      explanation = suggestion.scope === 'exact_context'
        ? `Similar measurements from this capture context have historically differed from raw model confidence (${suggestion.sampleCount} comparable verified measurements).`
        : suggestion.scope === 'measurement_type'
          ? `Similar ${context.measurementType ?? 'dimension'} measurements have historically differed from raw model confidence (${suggestion.sampleCount} comparable verified measurements).`
          : `Global verification history adjusts raw model confidence (${suggestion.sampleCount} comparable verified measurements).`
    }

    return {
      comparableCount: comparable.length,
      calibrated: suggestion,
      summarySampleCount: summary.sampleCount,
      captureReliability,
      explanation
    }
  }

  return {
    findComparable,
    explainCalibration,
    productionOrigin: PRODUCTION_EVIDENCE_ORIGIN
  }
}
