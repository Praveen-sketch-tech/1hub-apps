/**
 * Analytics adapter for Smart PDF Tools.
 *
 * The feature module never imports Supabase or any host-specific analytics
 * code directly. Instead, the host app can register a tracking function via
 * `setAnalyticsHandler`. If no handler is registered, all calls are safely
 * no-ops (logged to console in dev) so the module works standalone.
 *
 * See integration/analytics-bridge-example.ts for how the base project
 * should wire this up to its existing `trackFeature` function.
 */

export type AnalyticsPayload = Record<string, string | number | boolean | undefined>;

export type AnalyticsHandler = (eventName: string, payload: AnalyticsPayload) => void;

let handler: AnalyticsHandler | null = null;

/** Called once by the host app to connect Smart PDF Tools to real analytics. */
export function setAnalyticsHandler(fn: AnalyticsHandler | null): void {
  handler = fn;
}

export const SMART_PDF_EVENTS = {
  PDF_UPLOADED: 'pdf_uploaded',
  IMAGE_UPLOADED_FOR_PDF: 'image_uploaded_for_pdf',
  IMAGES_TO_PDF_USED: 'images_to_pdf_used',
  PDF_MERGE_USED: 'pdf_merge_used',
  PDF_SPLIT_USED: 'pdf_split_used',
  PDF_COMPRESS_USED: 'pdf_compress_used',
  PDF_PAGE_ROTATED: 'pdf_page_rotated',
  PDF_PAGE_DELETED: 'pdf_page_deleted',
  PDF_PAGES_REORDERED: 'pdf_pages_reordered',
  PDF_PAGES_EXTRACTED: 'pdf_pages_extracted',
  PDF_DOWNLOADED: 'pdf_downloaded',
} as const;

export type SmartPdfEventName = (typeof SMART_PDF_EVENTS)[keyof typeof SMART_PDF_EVENTS];

export function trackSmartPdfEvent(eventName: SmartPdfEventName, payload: AnalyticsPayload = {}): void {
  try {
    if (handler) {
      handler(eventName, payload);
    } else if (typeof console !== 'undefined' && import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[smart-pdf-tools:analytics:noop]', eventName, payload);
    }
  } catch {
    // Analytics must never break the app.
  }
}
