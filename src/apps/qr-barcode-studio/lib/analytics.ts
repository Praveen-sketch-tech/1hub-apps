// App #003 — QR & Barcode Studio
// Host-independent analytics adapter.
// The host app registers a real handler via setAnalyticsHandler().
// This module NEVER imports Supabase or any host module directly.

import type { AnalyticsEventName, AnalyticsPayload, AnalyticsHandler } from '../types';

let handler: AnalyticsHandler | null = null;

/**
 * Registered by the host application (see integration/analytics-bridge-example.ts).
 * Example:
 *   setAnalyticsHandler((eventName, payload) => {
 *     trackFeature(eventName, { app: 'qr_barcode_studio', ...payload });
 *   });
 */
export function setAnalyticsHandler(fn: AnalyticsHandler | null): void {
  handler = fn;
}

/**
 * Fires an analytics event if a handler has been registered.
 * Safe to call even if no handler is set (no-op).
 * NEVER pass full decoded QR/barcode content, Wi-Fi passwords,
 * email bodies, or vCard personal data in the payload.
 */
export function track(eventName: AnalyticsEventName, payload?: AnalyticsPayload): void {
  if (!handler) return;
  try {
    handler(eventName, payload);
  } catch (err) {
    // Analytics must never break the app.
    // eslint-disable-next-line no-console
    console.warn('[qr-barcode-studio] analytics handler failed:', err);
  }
}
