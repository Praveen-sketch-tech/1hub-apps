import { trackFeature } from '@core/hooks/useAnalytics'

export type SmartImageEvent =
  | 'image_uploaded'
  | 'compress_used'
  | 'resize_used'
  | 'convert_used'
  | 'crop_used'
  | 'image_downloaded'

export type AnalyticsPayload = Record<
  string,
  string | number | boolean | null
>

/**
 * Sends Smart Image Tools events through the existing
 * Supabase-backed Hub Apps analytics system.
 */
export function trackSmartImageEvent(
  event: SmartImageEvent,
  payload: AnalyticsPayload = {}
): void {
  try {
    trackFeature(event, {
      app: 'smart_image_tools',
      ...payload
    })
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Smart Image Tools analytics failed safely:', error)
    }
  }
}
