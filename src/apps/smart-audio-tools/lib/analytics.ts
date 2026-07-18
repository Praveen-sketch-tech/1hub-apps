type AnalyticsHandler = (eventName: string, properties?: Record<string, unknown>) => void

let analyticsHandler: AnalyticsHandler | null = null

export function setAnalyticsHandler(handler: AnalyticsHandler | null) {
  analyticsHandler = handler
}

export function trackAudioToolEvent(eventName: string, properties?: Record<string, unknown>) {
  try {
    analyticsHandler?.(eventName, properties)
  } catch {
    // Analytics must never break app functionality.
  }
}
