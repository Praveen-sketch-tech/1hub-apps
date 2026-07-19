// ============================================================================
// Smart Metadata & Privacy Tools — shared types
// ============================================================================

export type SupportedCategory =
  | 'image-jpeg'
  | 'image-png'
  | 'image-webp'
  | 'image-other'
  | 'pdf'
  | 'audio'
  | 'video'
  | 'other';

export interface BasicFileInfo {
  name: string;
  type: string; // MIME type as reported by the browser
  size: number; // bytes
  lastModified: number | null; // epoch ms, when available
  category: SupportedCategory;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface MetadataField {
  /** Stable machine key, e.g. "gpsLatitude" */
  key: string;
  /** Human readable label, e.g. "GPS Latitude" */
  label: string;
  /** Human readable value, already formatted for display */
  value: string;
  /** Whether this field is considered privacy sensitive */
  sensitive: boolean;
  /** Short explanation of why the field matters, shown in the UI */
  note?: string;
}

export interface MetadataGroup {
  /** Section heading, e.g. "Camera & Device" */
  title: string;
  fields: MetadataField[];
}

export interface PrivacyFlag {
  key: string;
  label: string;
  level: RiskLevel;
  reason: string;
}

export interface PrivacyRiskSummary {
  overall: RiskLevel;
  flags: PrivacyFlag[];
}

export type CleaningSupport =
  | { supported: true; reason?: undefined }
  | { supported: false; reason: string };

export interface InspectionResult {
  file: BasicFileInfo;
  groups: MetadataGroup[];
  privacy: PrivacyRiskSummary;
  cleaning: CleaningSupport;
  /** Raw warnings encountered while parsing (corrupt/partial data etc.) */
  warnings: string[];
}

export interface CleanResult {
  blob: Blob;
  fileName: string;
  originalFormat: string;
  outputFormat: string;
  originalSize: number;
  cleanedSize: number;
  /** Plain-language note about exactly what was and wasn't removed */
  note: string;
}

export type ImageOutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';
