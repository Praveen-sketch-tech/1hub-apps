// App #003 — QR & Barcode Studio
// Public entry point for the feature module.

export { default as QrBarcodeStudioPage } from './QrBarcodeStudioPage';
export { setAnalyticsHandler } from './lib/analytics';
export type {
  QrType,
  QrData,
  QrCustomization,
  BarcodeFormat,
  BarcodeCustomization,
  ScanHistoryEntry,
  ScanOutcome,
  AnalyticsEventName,
} from './types';
