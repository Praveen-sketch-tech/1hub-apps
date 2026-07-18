import type { AppChatModule } from '@core/chat/types'
import type {
  DocumentPage,
  OcrLanguage,
} from './lib/types'
import {
  DEFAULT_SETTINGS,
  defaultQuad,
  detectDocumentQuad,
  loadImage,
  renderProcessedPage,
} from './lib/imageProcessing'
import { recognizeCanvas } from './lib/ocrEngine'

function getLanguage(input: string): OcrLanguage {
  if (
    /hindi only|only hindi|sirf hindi/i.test(input)
  ) {
    return 'hin'
  }

  if (
    /hindi|eng\+hin|english hindi|hindi english|both/i.test(input)
  ) {
    return 'eng+hin'
  }

  return 'eng'
}

export const chatModule: AppChatModule = {
  appId: 'smart-document-scanner-ocr',
  actions: [
    {
      id: 'image-ocr',
      appId: 'smart-document-scanner-ocr',
      label: 'Extract text with OCR',
      description: 'Extract text from an attached document image locally.',
      keywords: [
        'ocr',
        'extract text',
        'read text',
        'image se text',
        'photo se text',
        'text nikalo',
        'text nikal',
      ],
      requiresFile: true,
      accepts: ['image/*'],
      canHandle: ({ input, file }) =>
        Boolean(
          file?.type.startsWith('image/') &&
          /ocr|extract text|read text|image se text|photo se text|text nikal/i.test(input),
        ),
      execute: async ({ input, file }) => {
        if (!file) return null

        const sourceUrl = URL.createObjectURL(file)

        try {
          const image = await loadImage(sourceUrl)

          let quad = defaultQuad(
            image.naturalWidth,
            image.naturalHeight,
          )

          try {
            quad = await detectDocumentQuad(sourceUrl)
          } catch {
            // Default full-image crop remains available.
          }

          const page: DocumentPage = {
            id: crypto.randomUUID(),
            name: file.name,
            sourceUrl,
            width: image.naturalWidth,
            height: image.naturalHeight,
            rotation: 0,
            quad,
            settings: {
              ...DEFAULT_SETTINGS,
              mode: 'auto',
            },
            ocr: {
              text: '',
              progress: 0,
              status: 'idle',
            },
          }

          const canvas = await renderProcessedPage(page)
          const language = getLanguage(input)

          const text = await recognizeCanvas(
            canvas,
            language,
            () => {},
          )

          const cleanText = text.trim()

          if (!cleanText) {
            return {
              text: 'OCR complete hua, lekin image me readable text detect nahi hua.',
            }
          }

          return {
            text:
              cleanText.length > 3000
                ? `${cleanText.slice(0, 3000)}\n\n[Output truncated in chat — full OCR text download karo.]`
                : cleanText,
            blob: new Blob(
              [cleanText],
              {
                type: 'text/plain;charset=utf-8',
              },
            ),
            fileName: `${file.name.replace(/\.[^/.]+$/, '') || 'ocr'}-text.txt`,
          }
        } finally {
          URL.revokeObjectURL(sourceUrl)
        }
      },
    },
  ],
}
