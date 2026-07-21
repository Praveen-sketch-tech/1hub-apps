export type BuiltInDocumentCategory =
  | 'Invoice'
  | 'Receipt'
  | 'Bank Statement'
  | 'Identity Document'
  | 'Resume / CV'
  | 'Contract / Agreement'
  | 'Letter / Notice'
  | 'Form / Application'
  | 'Certificate'
  | 'Report'
  | 'Tax Document'
  | 'Medical Document'
  | 'Education Document'
  | 'Payslip'
  | 'Purchase Order'
  | 'Other'

export type OcrLanguage = 'eng' | 'hin' | 'eng+hin'

export interface CustomClassificationRule {
  id: string
  category: string
  keywords: string[]
}

export interface CategoryScore {
  category: string
  score: number
  matchedSignals: string[]
}

export interface DocumentClassification {
  category: string
  confidence: number
  lowConfidence: boolean
  runnerUp?: string
  matchedSignals: string[]
  reasons: string[]
  scores: CategoryScore[]
}

export type ExtractionMethod =
  | 'pdf-text'
  | 'pdf-ocr'
  | 'image-ocr'
  | 'docx-text'
  | 'plain-text'
  | 'filename-only'

export interface DocumentExtraction {
  text: string
  method: ExtractionMethod
  pagesRead: number
  ocrPages: number
  warnings: string[]
}

export type DocumentStatus = 'queued' | 'processing' | 'done' | 'error'

export interface ClassifiedDocumentItem {
  id: string
  file: File
  status: DocumentStatus
  progress: number
  statusText: string
  extraction?: DocumentExtraction
  classification?: DocumentClassification
  overrideCategory?: string
  error?: string
}
