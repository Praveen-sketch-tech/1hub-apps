import { trackFeature } from '@core/hooks/useAnalytics'
import { setAnalyticsHandler } from './analytics'

let connected = false

export function connectQrBarcodeStudioAnalytics(): void {
  if (connected) return
  connected = true

  setAnalyticsHandler((eventName, payload) => {
    trackFeature(eventName, {
      app: 'qr_barcode_studio',
      ...payload,
    })
  })
}
