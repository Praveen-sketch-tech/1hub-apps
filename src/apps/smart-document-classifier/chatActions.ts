import type { AppChatModule } from '@core/chat/types'
import { classifyDocument } from './lib/documentClassifier'
import { createOcrSession, extractDocumentText } from './lib/documentReader'
import type { OcrLanguage } from './lib/types'

function readLanguage(input: string): OcrLanguage {
  if (/english\s*\+\s*hindi|eng\s*\+\s*hin|bilingual/i.test(input)) return 'eng+hin'
  if (/\bhindi\b|\bhin\b/i.test(input)) return 'hin'
  return 'eng'
}

function outputName(fileName: string) {
  const base = fileName.replace(/\.[^/.]+$/, '') || 'document'
  return `${base}-classification.json`
}

export const chatModule: AppChatModule = {
  appId: 'smart-document-classifier',
  actions: [
    {
      id: 'classify-document-locally',
      appId: 'smart-document-classifier',
      label: 'Classify a document locally',
      description: 'Read an attached PDF, DOCX, text file or image locally and classify it with transparent keyword and pattern rules.',
      keywords: [
        'classify document',
        'document classify',
        'identify document type',
        'document category',
        'ye document kya hai',
        'file category batao',
      ],
      requiresFile: true,
      accepts: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/*',
        'image/*',
      ],
      canHandle: ({ input, file }) => Boolean(
        file && /classif|document\s*(?:type|category)|identify\s*(?:this\s*)?(?:document|file)|ye\s*(?:document|file)\s*kya|category\s*bata/i.test(input),
      ),
      execute: async ({ input, file }) => {
        if (!file) return null
        const language = readLanguage(input)
        const useOcr = !/without\s+ocr|no\s+ocr|ocr\s+off/i.test(input)
        const ocrSession = createOcrSession(language)

        try {
          const extraction = await extractDocumentText(file, {
            useOcr,
            language,
            maxPdfPages: 30,
            maxOcrPages: 3,
            ocrSession,
          })
          const classification = classifyDocument({
            text: extraction.text,
            fileName: file.name,
          })
          const report = {
            fileName: file.name,
            category: classification.category,
            confidence: classification.confidence,
            lowConfidence: classification.lowConfidence,
            runnerUp: classification.runnerUp,
            matchedSignals: classification.matchedSignals,
            reasons: classification.reasons,
            extraction,
            method: 'Deterministic local rules; not AI classification.',
          }
          const warning = classification.lowConfidence ? ' Manual review is recommended.' : ''
          const extractionNote = extraction.method === 'filename-only'
            ? ' No readable content was extracted, so filename evidence was used.'
            : ` Text source: ${extraction.method}.`

          return {
            text: `Document classified locally as ${classification.category} with ${classification.confidence}% confidence.${warning}${extractionNote} This uses visible keyword/pattern rules, not an AI model.`,
            blob: new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
            fileName: outputName(file.name),
          }
        } finally {
          await ocrSession.dispose()
        }
      },
    },
  ],
}
