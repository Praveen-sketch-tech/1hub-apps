import type { AppChatModule } from '@core/chat/types'
import { generateTestAsset } from './lib/assetFactory'

function numberFrom(input: string, pattern: RegExp, fallback: number): number {
  const match = input.match(pattern)
  return match ? Number(match[1]) || fallback : fallback
}

export const chatModule: AppChatModule = {
  appId: 'universal-test-asset-factory',
  actions: [
    {
      id: 'generate-ocr-test-image',
      appId: 'universal-test-asset-factory',
      label: 'Generate OCR test image',
      description: 'Generate a text-rich OCR test image locally with optional scan styling, noise and skew.',
      keywords: ['ocr test image', 'ocr image', 'scanned image', 'test document image'],
      canHandle: ({ input }) => /\b(ocr|scanned?)\b.*\b(image|jpg|jpeg|png|webp)\b|\b(image|jpg|jpeg|png|webp)\b.*\bocr\b/i.test(input),
      execute: async ({ input }) => {
        const type = /\bwebp\b/i.test(input) ? 'webp' : /\bjpe?g\b/i.test(input) ? 'jpg' : 'png'
        const asset = await generateTestAsset({
          assetType: type,
          preset: 'ocr-document',
          width: 1200,
          height: 1600,
          scanStyle: /scan/i.test(input),
          noise: /noise|noisy/i.test(input) ? 14 : 4,
          skew: /skew/i.test(input) ? 2 : 0,
          fileName: 'ocr-test-image',
        })
        return { text: asset.summary, blob: asset.blob, fileName: asset.fileName }
      },
    },
    {
      id: 'generate-scanned-pdf',
      appId: 'universal-test-asset-factory',
      label: 'Generate scanned multi-page PDF',
      description: 'Generate a local multi-page PDF with OCR-readable text, scan styling, tables and optional QR content.',
      keywords: ['scanned pdf', 'multi page pdf', 'ocr pdf', 'test pdf'],
      canHandle: ({ input }) => /\b(pdf)\b/i.test(input) && /\b(scan|scanned|ocr|multi[- ]?page|test)\b/i.test(input),
      execute: async ({ input }) => {
        const pageCount = Math.max(1, Math.min(numberFrom(input, /(\d+)\s*(?:page|pages)/i, 3), 20))
        const asset = await generateTestAsset({
          assetType: 'pdf',
          preset: 'scanned-document',
          pageCount,
          scanStyle: true,
          includeQr: /\bqr\b/i.test(input),
          fileName: 'scanned-multipage-test',
        })
        return { text: asset.summary, blob: asset.blob, fileName: asset.fileName }
      },
    },
    {
      id: 'generate-sample-xlsx',
      appId: 'universal-test-asset-factory',
      label: 'Generate sample XLSX workbook',
      description: 'Generate a structured XLSX workbook locally with multiple sheets, formulas, duplicates and missing values.',
      keywords: ['xlsx', 'spreadsheet', 'excel', 'formulas', 'duplicate rows', 'missing values'],
      canHandle: ({ input }) => /\b(xlsx|excel|spreadsheet|workbook)\b/i.test(input) && /\b(generate|create|sample|test)\b/i.test(input),
      execute: async ({ input }) => {
        const rowCount = Math.max(5, Math.min(numberFrom(input, /(\d+)\s*(?:row|rows)/i, 30), 5000))
        const sheetCount = Math.max(1, Math.min(numberFrom(input, /(\d+)\s*(?:sheet|sheets)/i, 3), 5))
        const asset = await generateTestAsset({
          assetType: 'xlsx',
          rowCount,
          sheetCount,
          includeFormulas: !/without formulas?/i.test(input),
          includeDuplicates: !/without duplicates?/i.test(input),
          includeMissingValues: !/without missing/i.test(input),
          fileName: 'sample-test-workbook',
        })
        return { text: asset.summary, blob: asset.blob, fileName: asset.fileName }
      },
    },
    {
      id: 'generate-qr-test-image',
      appId: 'universal-test-asset-factory',
      label: 'Generate QR test image',
      description: 'Generate a downloadable QR-containing PNG test image locally.',
      keywords: ['qr', 'qr code', 'test qr', 'qr image'],
      canHandle: ({ input }) => /\bqr(?:\s+code)?\b/i.test(input) && /\b(generate|create|sample|test|image)\b/i.test(input),
      execute: async ({ input }) => {
        const urlMatch = input.match(/https?:\/\/\S+/i)
        const asset = await generateTestAsset({
          assetType: 'png',
          preset: 'qr',
          width: 900,
          height: 900,
          qrText: urlMatch?.[0] ?? 'https://1hub-apps.vercel.app',
          fileName: 'qr-test-image',
        })
        return { text: asset.summary, blob: asset.blob, fileName: asset.fileName }
      },
    },
    {
      id: 'generate-barcode-test-image',
      appId: 'universal-test-asset-factory',
      label: 'Generate barcode test image',
      description: 'Generate a downloadable CODE128 barcode PNG test image locally.',
      keywords: ['barcode', 'code128', 'test barcode', 'barcode image'],
      canHandle: ({ input }) => /\bbar\s?code|\bbarcode\b|\bcode128\b/i.test(input) && /\b(generate|create|sample|test|image)\b/i.test(input),
      execute: async ({ input }) => {
        const code = input.match(/\b\d{8,20}\b/)?.[0] ?? '017202600001'
        const asset = await generateTestAsset({
          assetType: 'png',
          preset: 'barcode',
          width: 1200,
          height: 700,
          barcodeText: code,
          fileName: 'barcode-test-image',
        })
        return { text: asset.summary, blob: asset.blob, fileName: asset.fileName }
      },
    },
    {
      id: 'generate-sample-data-file',
      appId: 'universal-test-asset-factory',
      label: 'Generate sample data file',
      description: 'Generate structured CSV, JSON or TXT test data locally for data-cleaning and workflow testing.',
      keywords: ['sample csv', 'sample json', 'sample txt', 'test data', 'data file'],
      canHandle: ({ input }) => /\b(csv|json|txt|text file|data file)\b/i.test(input) && /\b(generate|create|sample|test)\b/i.test(input),
      execute: async ({ input }) => {
        const assetType = /\bjson\b/i.test(input) ? 'json' : /\btxt|text file\b/i.test(input) ? 'txt' : 'csv'
        const rowCount = Math.max(5, Math.min(numberFrom(input, /(\d+)\s*(?:row|rows)/i, 30), 5000))
        const asset = await generateTestAsset({
          assetType,
          rowCount,
          includeDuplicates: /duplicate/i.test(input),
          includeMissingValues: /missing|null/i.test(input),
          fileName: `sample-test-${assetType}`,
        })
        return { text: asset.summary, blob: asset.blob, fileName: asset.fileName }
      },
    },
    {
      id: 'generate-test-asset-bundle',
      appId: 'universal-test-asset-factory',
      label: 'Generate mixed test asset bundle',
      description: 'Generate a ZIP bundle containing reusable OCR, PDF, spreadsheet, data, QR and barcode test assets.',
      keywords: ['test asset bundle', 'sample files zip', 'mixed test assets', 'test bundle'],
      canHandle: ({ input }) => /\b(zip|bundle|mixed assets|test assets)\b/i.test(input) && /\b(generate|create|sample|test)\b/i.test(input),
      execute: async () => {
        const asset = await generateTestAsset({ assetType: 'zip', fileName: 'universal-test-assets' })
        return { text: asset.summary, blob: asset.blob, fileName: asset.fileName }
      },
    },
  ],
}
