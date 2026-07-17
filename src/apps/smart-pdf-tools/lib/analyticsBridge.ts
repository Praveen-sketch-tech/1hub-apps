import { trackFeature } from '@core/hooks/useAnalytics'
import { setAnalyticsHandler } from './analytics'

let connected = false

export function connectSmartPdfToolsAnalytics(): void {
  if (connected) return
  connected = true

  setAnalyticsHandler((eventName, payload) => {
    trackFeature(eventName, {
      app: 'smart_pdf_tools',
      ...payload,
    })
  })
}
