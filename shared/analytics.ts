export type AnalyticsEventName =
  | 'scan_started'
  | 'scan_completed'
  | 'analysis_viewed'
  | 'decision_unstable'
  | 'verification_requested'
  | 'measurement_verification_started'
  | 'measurement_manually_verified'
  | 'evidence_recorded'
  | 'decision_stabilized'
  | 'calibration_applied'

export type AnalyticsValue = string | number | boolean | null
export type AnalyticsProperties = Readonly<Record<string, AnalyticsValue>>

export interface AnalyticsEvent {
  name: AnalyticsEventName
  properties: AnalyticsProperties
}

export interface ProductAnalytics {
  track(name: AnalyticsEventName, properties?: AnalyticsProperties): void
}

const ALLOWED_PROPERTIES = new Set([
  'measurementType',
  'captureMethod',
  'modelVersion',
  'rawConfidence',
  'calibratedConfidence',
  'calibrationScope',
  'evidenceCount',
  'stabilityBefore',
  'stabilityAfter',
  'stabilityGain',
  'measurementCount',
  'unresolvedCount'
])

export const sanitizeAnalyticsProperties = (properties: AnalyticsProperties = {}) => Object.fromEntries(
  Object.entries(properties).filter(([key, value]) => ALLOWED_PROPERTIES.has(key) && (
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null
  ))
)

export class InMemoryAnalytics implements ProductAnalytics {
  readonly events: AnalyticsEvent[] = []

  track(name: AnalyticsEventName, properties: AnalyticsProperties = {}) {
    this.events.push({ name, properties: sanitizeAnalyticsProperties(properties) })
  }
}

export const createAnalytics = (dispatch?: (event: AnalyticsEvent) => void): ProductAnalytics => ({
  track(name, properties = {}) {
    dispatch?.({ name, properties: sanitizeAnalyticsProperties(properties) })
  }
})
