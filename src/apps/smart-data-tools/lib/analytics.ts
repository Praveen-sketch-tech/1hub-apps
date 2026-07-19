export type AnalyticsPayload = Record<string, string | number | boolean | undefined>
export type AnalyticsHandler = (eventName: string, payload: AnalyticsPayload) => void
let handler: AnalyticsHandler | null = null

export function setAnalyticsHandler(fn: AnalyticsHandler | null): void { handler = fn }

export function trackSmartDataEvent(eventName: string, payload: AnalyticsPayload = {}): void {
  try {
    if (handler) handler(eventName, payload)
    else if (import.meta.env.DEV) console.debug('[smart-data-tools]', eventName, payload)
  } catch {}
}
