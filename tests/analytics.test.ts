import { describe, expect, it } from 'vitest'
import { InMemoryAnalytics, sanitizeAnalyticsProperties } from '../shared/analytics'

describe('analytics privacy contract', () => {
  it('keeps approved decision metadata and removes household identifiers', () => {
    expect(sanitizeAnalyticsProperties({
      measurementType: 'height', rawConfidence: 0.7, roomName: 'Living Room', address: 'private', deviceId: 'secret'
    })).toEqual({ measurementType: 'height', rawConfidence: 0.7 })
  })

  it('records typed events through an interchangeable sink', () => {
    const analytics = new InMemoryAnalytics()
    analytics.track('evidence_recorded', { measurementType: 'height', evidenceCount: 1 })
    expect(analytics.events).toEqual([{ name: 'evidence_recorded', properties: { measurementType: 'height', evidenceCount: 1 } }])
  })
})
