// App #003 — QR & Barcode Studio
// Shared TypeScript types

export type QrType =
  | 'url'
  | 'text'
  | 'phone'
  | 'email'
  | 'sms'
  | 'wifi'
  | 'vcard';

export interface UrlQrData {
  url: string;
}

export interface TextQrData {
  text: string;
}

export interface PhoneQrData {
  phone: string;
}

export interface EmailQrData {
  email: string;
  subject?: string;
  message?: string;
}

export interface SmsQrData {
  phone: string;
  message?: string;
}

export type WifiSecurity = 'WPA' | 'WEP' | 'nopass';

export interface WifiQrData {
  ssid: string;
  password?: string;
  security: WifiSecurity;
  hidden: boolean;
}

export interface VCardQrData {
  firstName: string;
  lastName?: string;
  organization?: string;
  jobTitle?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export type QrData =
  | { type: 'url'; data: UrlQrData }
  | { type: 'text'; data: TextQrData }
  | { type: 'phone'; data: PhoneQrData }
  | { type: 'email'; data: EmailQrData }
  | { type: 'sms'; data: SmsQrData }
  | { type: 'wifi'; data: WifiQrData }
  | { type: 'vcard'; data: VCardQrData };

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrLogoOptions {
  imageDataUrl: string;
  sizeRatio: number; // fraction of QR width, e.g. 0.2
  withBackground: boolean;
}

export interface QrCustomization {
  size: number;
  foregroundColor: string;
  backgroundColor: string;
  margin: number;
  errorCorrectionLevel: ErrorCorrectionLevel;
  logo?: QrLogoOptions | null;
}

export const DEFAULT_QR_CUSTOMIZATION: QrCustomization = {
  size: 512,
  foregroundColor: '#000000',
  backgroundColor: '#ffffff',
  margin: 4,
  errorCorrectionLevel: 'M',
  logo: null,
};

export type BarcodeFormat =
  | 'CODE128'
  | 'CODE39'
  | 'EAN13'
  | 'EAN8'
  | 'UPC'
  | 'ITF14';

export interface BarcodeCustomization {
  format: BarcodeFormat;
  width: number;
  height: number;
  displayValue: boolean;
  fontSize: number;
  margin: number;
  foregroundColor: string;
  backgroundColor: string;
}

export const DEFAULT_BARCODE_CUSTOMIZATION: BarcodeCustomization = {
  format: 'CODE128',
  width: 2,
  height: 100,
  displayValue: true,
  fontSize: 16,
  margin: 10,
  foregroundColor: '#000000',
  backgroundColor: '#ffffff',
};

export type ScanSourceType = 'camera' | 'image';

export interface ScanHistoryEntry {
  id: string;
  format: string;
  value: string;
  timestamp: number;
  source: ScanSourceType;
}

export interface ScanOutcome {
  format: string;
  value: string;
  source: ScanSourceType;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export type AnalyticsEventName =
  | 'qr_generated'
  | 'qr_downloaded'
  | 'qr_logo_added'
  | 'barcode_generated'
  | 'barcode_downloaded'
  | 'scanner_camera_started'
  | 'scanner_camera_stopped'
  | 'qr_scanned'
  | 'barcode_scanned'
  | 'scan_result_copied'
  | 'scan_url_opened'
  | 'print_used';

export type AnalyticsPayload = Record<string, string | number | boolean | undefined>;

export type AnalyticsHandler = (
  eventName: AnalyticsEventName,
  payload?: AnalyticsPayload
) => void;

export type DownloadFormat = 'png' | 'svg';
