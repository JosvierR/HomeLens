import type { AnalyticsEvent, AnalyticsEventName, AnalyticsProperties } from '~~/shared/analytics'
import { createAnalytics } from '~~/shared/analytics'

export const useProductAnalytics = () => {
  const events = useState<AnalyticsEvent[]>('product-analytics-events', () => [])
  const analytics = createAnalytics(event => { events.value.push(event) })
  const track = (name: AnalyticsEventName, properties: AnalyticsProperties = {}) => analytics.track(name, properties)
  return { track, events: readonly(events) }
}
