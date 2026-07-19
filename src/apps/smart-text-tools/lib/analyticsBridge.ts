import { trackFeature } from '@core/hooks/useAnalytics'
import { setAnalyticsHandler } from './analytics'

let connected = false

export function connectSmartTextToolsAnalytics(): void {
  if (connected) return
  connected = true

  setAnalyticsHandler((eventName, payload) => {
    trackFeature(eventName, {
      app: 'smart_text_tools',
      ...payload,
    })
  })
}
