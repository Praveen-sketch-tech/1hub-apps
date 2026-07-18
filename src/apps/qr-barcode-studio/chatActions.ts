import type { AppChatModule } from '@core/chat/types'
import { renderQrCode } from './lib/qrGenerator'
import {
  renderBarcode,
  renderBarcodePng,
} from './lib/barcodeGenerator'
import {
  DEFAULT_QR_CUSTOMIZATION,
  DEFAULT_BARCODE_CUSTOMIZATION,
} from './types'

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(',')
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? 'application/octet-stream'
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Blob([bytes], { type: mime })
}

function extractPayload(input: string) {
  return input
    .replace(/^(?:create|generate|make|bana(?:o|na)?|banao)\s+/i, '')
    .replace(/(?:qr\s*code|qr|barcode)\s*(?:for|of|ka|ke liye)?\s*/i, '')
    .trim()
}

export const chatModule: AppChatModule = {
  appId: 'qr-barcode-studio',
  actions: [
    {
      id: 'generate-qr',
      appId: 'qr-barcode-studio',
      label: 'Generate QR code',
      description: 'Generate a QR code directly in chat.',
      keywords: ['qr', 'qr code', 'generate qr', 'create qr', 'qr banao'],
      canHandle: ({ input }) =>
        /\bqr\b|qr code/i.test(input),
      execute: async ({ input }) => {
        const payload = extractPayload(input)

        if (!payload) {
          return {
            text: 'QR banane ke liye text ya URL bhi batao. Example: QR for https://example.com',
          }
        }

        const result = await renderQrCode(
          payload,
          DEFAULT_QR_CUSTOMIZATION,
        )

        return {
          text: `QR code generated for: ${payload}`,
          blob: dataUrlToBlob(result.pngDataUrl),
          fileName: 'qr-code.png',
        }
      },
    },
    {
      id: 'generate-barcode',
      appId: 'qr-barcode-studio',
      label: 'Generate barcode',
      description: 'Generate a CODE128 barcode directly in chat.',
      keywords: ['barcode', 'generate barcode', 'create barcode', 'barcode banao'],
      canHandle: ({ input }) =>
        /\bbarcode\b/i.test(input),
      execute: async ({ input }) => {
        const value = extractPayload(input)

        if (!value) {
          return {
            text: 'Barcode banane ke liye value batao. Example: Barcode for ABC12345',
          }
        }

        const result = renderBarcode(
          value,
          DEFAULT_BARCODE_CUSTOMIZATION,
        )

        const pngDataUrl = await renderBarcodePng(
          result.svgMarkup,
        )

        return {
          text: `Barcode generated for: ${value}`,
          blob: dataUrlToBlob(pngDataUrl),
          fileName: 'barcode.png',
        }
      },
    },
  ],
}
