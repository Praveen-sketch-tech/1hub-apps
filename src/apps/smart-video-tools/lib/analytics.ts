type AnalyticsHandler = (event: string, properties?: Record<string, string | number | boolean>) => void

let analyticsHandler: AnalyticsHandler | null = null

export function setAnalyticsHandler(handler: AnalyticsHandler | null) {
  analyticsHandler = handler
}

export function trackVideoToolEvent(
  event: string,
  properties?: Record<string, string | number | boolean>,
) {
  try {
    analyticsHandler?.(event, properties)
  } catch {
    // Analytics must never break the app.
  }
}
