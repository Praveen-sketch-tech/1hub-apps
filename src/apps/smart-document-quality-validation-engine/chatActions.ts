import type { AppChatModule } from '@core/chat/types'
import { reportsToJson } from './lib/exporters'
import { reportFileName, validateDocumentFile } from './lib/qualityEngine'
import type { OcrLanguage, ValidationPreset } from './lib/types'

function readLanguage(input: string): OcrLanguage {
  if (/english\s*\+\s*hindi|hindi\s*\+\s*english|eng\+hin/i.test(input)) return 'eng+hin'
  if (/\bhindi\b|\bhin\b/i.test(input)) return 'hin'
  return 'eng'
}

function readPreset(input: string): ValidationPreset {
  if (/bank\s*statement/i.test(input)) return 'bank-statement'
  if (/identity|kyc|aadhaar|aadhar|pan\s*card|passport/i.test(input)) return 'identity-document'
  if (/receipt/i.test(input)) return 'receipt'
  if (/invoice|bill/i.test(input)) return 'invoice'
  return 'general'
}

function readThreshold(input: string) {
  const match = input.match(/(?:threshold|pass\s*score)\s*[:=]?\s*(\d{2})/i)
  return Math.max(60, Math.min(95, Number(match?.[1] ?? 80)))
}

export const chatModule: AppChatModule = {
  appId: 'smart-document-quality-validation-engine',
  actions: [
    {
      id: 'validate-document-quality',
      appId: 'smart-document-quality-validation-engine',
      label: 'Validate document quality',
      description: 'Check an attached document locally for readability, blur, contrast, skew, blank pages, OCR text quality, required fields and duplicate PDF pages.',
      keywords: [
        'validate document',
        'document quality',
        'check document quality',
        'document readable',
        'blur check document',
        'document verification',
        'document check karo',
      ],
      requiresFile: true,
      accepts: ['application/pdf', 'image/*', 'text/*', '.docx'],
      canHandle: ({ input, file }) => Boolean(
        file && /validate\s*(?:this\s*)?document|document\s*(?:quality|validation|readability|check)|check\s*(?:this\s*)?(?:file|document)|blur\s*check|document\s*(?:verify|verification)/i.test(input),
      ),
      execute: async ({ input, file }) => {
        if (!file) return null
        const report = await validateDocumentFile(file, {
          useOcr: !/without\s+ocr|ocr\s+off|no\s+ocr/i.test(input),
          language: readLanguage(input),
          maxPdfPages: 12,
          maxOcrPages: 3,
          preset: readPreset(input),
          threshold: readThreshold(input),
          detectDuplicates: true,
          customKeywords: [],
          customPatterns: [],
          includeExtractedText: false,
        })
        const errors = report.findings.filter((finding) => finding.severity === 'error').length
        const warnings = report.findings.filter((finding) => finding.severity === 'warning').length
        const blob = new Blob([reportsToJson([report], false)], { type: 'application/json;charset=utf-8' })
        return {
          text: `Document validation finished locally. Decision: ${report.decision.toUpperCase()}, score ${report.score}/100, grade ${report.grade}. Checked ${report.pagesRead} page${report.pagesRead === 1 ? '' : 's'} with ${errors} error${errors === 1 ? '' : 's'} and ${warnings} warning${warnings === 1 ? '' : 's'}. This is a browser-based quality/rule report, not legal or compliance approval.`,
          blob,
          fileName: reportFileName(file.name, 'json'),
        }
      },
    },
  ],
}
