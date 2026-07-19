export type AssetType = 'jpg' | 'png' | 'webp' | 'pdf' | 'csv' | 'xlsx' | 'txt' | 'json' | 'zip'

export type ImagePreset = 'ocr-document' | 'invoice' | 'form' | 'table' | 'qr' | 'barcode' | 'test-pattern'
export type DocumentPreset = 'clean-document' | 'scanned-document' | 'ocr-document' | 'invoice' | 'form' | 'mixed'

export interface AssetGenerationOptions {
  assetType: AssetType
  fileName?: string
  preset?: ImagePreset | DocumentPreset | string
  width?: number
  height?: number
  pageCount?: number
  rowCount?: number
  sheetCount?: number
  includeDuplicates?: boolean
  includeMissingValues?: boolean
  includeFormulas?: boolean
  includeQr?: boolean
  includeBarcode?: boolean
  transparent?: boolean
  blur?: number
  noise?: number
  skew?: number
  rotation?: number
  scanStyle?: boolean
  qrText?: string
  barcodeText?: string
  seed?: number
}

export interface GeneratedAsset {
  blob: Blob
  fileName: string
  mimeType: string
  assetType: AssetType
  previewUrl?: string
  summary: string
}
