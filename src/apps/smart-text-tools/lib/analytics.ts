export type AnalyticsPayload = Record<string, string | number | boolean | undefined>
export type AnalyticsHandler = (eventName: string, payload: AnalyticsPayload) => void
let handler: AnalyticsHandler | null = null

export function setAnalyticsHandler(fn: AnalyticsHandler | null): void {
  handler = fn
}

export const SMART_TEXT_EVENTS = {
  TEXT_CLEANED: 'text_cleaned',
  CASE_CONVERTED: 'case_converted',
  DUPLICATES_REMOVED: 'duplicate_lines_removed',
  LINES_SORTED: 'lines_sorted',
  FIND_REPLACE_USED: 'find_replace_used',
  PREFIX_SUFFIX_USED: 'prefix_suffix_used',
  VALUES_EXTRACTED: 'values_extracted',
  ENCODING_USED: 'encoding_used',
  OUTPUT_COPIED: 'text_output_copied',
  OUTPUT_DOWNLOADED: 'text_output_downloaded',
} as const

export type SmartTextEventName = (typeof SMART_TEXT_EVENTS)[keyof typeof SMART_TEXT_EVENTS]

export function trackSmartTextEvent(
  eventName: SmartTextEventName,
  payload: AnalyticsPayload = {},
): void {
  try {
    if (handler) handler(eventName, payload)
    else if (import.meta.env.DEV) console.debug('[smart-text-tools:analytics:noop]', eventName, payload)
  } catch {
    // Analytics must never break the tool.
  }
}
