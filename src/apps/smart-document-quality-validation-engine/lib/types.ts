export type OcrLanguage = 'eng' | 'hin' | 'eng+hin'
export type ValidationPreset = 'general' | 'invoice' | 'receipt' | 'bank-statement' | 'identity-document' | 'custom'
export type ValidationDecision = 'pass' | 'review' | 'fail'
export type FindingSeverity = 'error' | 'warning' | 'info'
export type ExtractionMethod = 'plain-text' | 'docx-text' | 'pdf-text' | 'pdf-ocr' | 'image-ocr' | 'filename-only'

export interface QualityFinding {
  id: string
  severity: FindingSeverity
  code: string
  title: string
  message: string
  pageNumber?: number
}

export interface PageQualityMetrics {
  pageNumber: number
  width: number
  height: number
  brightness: number
  contrast: number
  blankRatio: number
  edgeDensity: number
  blurVariance: number
  sharpnessScore: number
  skewAngle: number
  visualScore: number
  perceptualHash: string
  textCharacters: number
  usedOcr: boolean
  findings: QualityFinding[]
}

export interface TextQualityMetrics {
  characters: number
  words: number
  lines: number
  alphanumericRatio: number
  symbolNoiseRatio: number
  replacementCharacters: number
  repeatedCharacterRuns: number
  score: number
  findings: QualityFinding[]
}

export interface FieldValidationResult {
  id: string
  label: string
  required: boolean
  found: boolean
  value?: string
  source: 'preset' | 'custom-keyword' | 'custom-pattern'
  error?: string
}

export interface DuplicatePageGroup {
  pages: number[]
  similarity: number
}

export interface DocumentQualityReport {
  fileName: string
  fileType: string
  fileSize: number
  generatedAt: string
  extractionMethod: ExtractionMethod
  pagesRead: number
  ocrPages: number
  truncated: boolean
  score: number
  threshold: number
  decision: ValidationDecision
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  summary: string
  findings: QualityFinding[]
  pageMetrics: PageQualityMetrics[]
  textMetrics: TextQualityMetrics
  fieldResults: FieldValidationResult[]
  duplicateGroups: DuplicatePageGroup[]
  extractedText: string
  warnings: string[]
  capabilityNotes: string[]
}

export interface CustomPatternInput {
  label: string
  pattern: string
}

export interface DocumentValidationOptions {
  useOcr: boolean
  language: OcrLanguage
  maxPdfPages: number
  maxOcrPages: number
  preset: ValidationPreset
  threshold: number
  detectDuplicates: boolean
  customKeywords: string[]
  customPatterns: CustomPatternInput[]
  includeExtractedText?: boolean
  onProgress?: (progress: number, status: string) => void
}
