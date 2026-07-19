import JSZip from 'jszip'
import type { AssetGenerationOptions, GeneratedAsset } from '../types'
import { generateImageAsset } from './imageAssets'
import { generatePdfAsset } from './pdfAssets'
import { generateCsvAsset, generateJsonAsset, generateTextAsset } from './textAssets'
import { generateXlsxAsset } from './xlsxAssets'

export async function generateTestAsset(options: AssetGenerationOptions): Promise<GeneratedAsset> {
  switch (options.assetType) {
    case 'jpg':
    case 'png':
    case 'webp':
      return generateImageAsset(options)
    case 'pdf':
      return generatePdfAsset(options)
    case 'csv':
      return generateCsvAsset(options)
    case 'xlsx':
      return generateXlsxAsset(options)
    case 'txt':
      return generateTextAsset(options)
    case 'json':
      return generateJsonAsset(options)
    case 'zip':
      return generateZipBundle(options)
    default:
      throw new Error(`Unsupported asset type: ${String(options.assetType)}`)
  }
}

export async function generateZipBundle(options: AssetGenerationOptions = { assetType: 'zip' }): Promise<GeneratedAsset> {
  const zip = new JSZip()
  const shared = {
    rowCount: options.rowCount ?? 24,
    includeDuplicates: options.includeDuplicates ?? true,
    includeMissingValues: options.includeMissingValues ?? true,
    includeFormulas: options.includeFormulas ?? true,
    seed: options.seed ?? 17017,
  }
  const [ocr, qr, barcode, pdf, csv, xlsx, json, txt] = await Promise.all([
    generateImageAsset({ assetType: 'png', preset: 'ocr-document', width: 1200, height: 1600, scanStyle: true, noise: 10, fileName: 'ocr-test-document' }),
    generateImageAsset({ assetType: 'png', preset: 'qr', width: 900, height: 900, qrText: options.qrText, fileName: 'qr-test-image' }),
    generateImageAsset({ assetType: 'png', preset: 'barcode', width: 1200, height: 700, barcodeText: options.barcodeText, fileName: 'barcode-test-image' }),
    generatePdfAsset({ assetType: 'pdf', preset: 'scanned-document', pageCount: options.pageCount ?? 3, includeQr: true, scanStyle: true, fileName: 'scanned-multipage-document' }),
    generateCsvAsset({ ...shared, fileName: 'sample-data' }),
    generateXlsxAsset({ ...shared, sheetCount: options.sheetCount ?? 3, fileName: 'sample-workbook' }),
    generateJsonAsset({ ...shared, fileName: 'sample-data' }),
    generateTextAsset({ fileName: 'sample-text' }),
  ])
  const assets = [ocr, qr, barcode, pdf, csv, xlsx, json, txt]
  assets.forEach((asset) => zip.file(asset.fileName, asset.blob))
  zip.file('README.txt', 'Generated locally by 1 Hub Apps — Universal Test Asset Factory.\nContains reusable test assets for OCR, PDF, spreadsheet, data, QR and barcode workflows.\n')
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const base = (options.fileName ?? 'universal-test-asset-bundle').trim().replace(/\.[^.]+$/, '') || 'universal-test-asset-bundle'
  return {
    blob,
    fileName: `${base}.zip`,
    mimeType: 'application/zip',
    assetType: 'zip',
    summary: `ZIP bundle containing ${assets.length} reusable test assets plus a README.`,
  }
}

export const assetFactory = {
  generate: generateTestAsset,
  generateImage: generateImageAsset,
  generatePdf: generatePdfAsset,
  generateCsv: generateCsvAsset,
  generateXlsx: generateXlsxAsset,
  generateJson: generateJsonAsset,
  generateText: generateTextAsset,
  generateZip: generateZipBundle,
}
