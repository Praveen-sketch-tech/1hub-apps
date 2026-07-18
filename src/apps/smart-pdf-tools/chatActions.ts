import type { AppChatModule } from '@core/chat/types'
import { compressPdf } from './lib/pdfCompression'
import type { CompressionMode } from './types'

function getCompressionMode(input: string): CompressionMode {
  if (/strong|maximum|max|zyada|bahut|smallest/i.test(input)) {
    return 'strong'
  }

  if (/light|quality|high quality/i.test(input)) {
    return 'light'
  }

  return 'balanced'
}

export const chatModule: AppChatModule = {
  appId: 'smart-pdf-tools',
  actions: [
    {
      id: 'pdf-compress',
      appId: 'smart-pdf-tools',
      label: 'Compress PDF',
      description: 'Compress an attached PDF locally in the browser.',
      keywords: [
        'compress pdf',
        'pdf compress',
        'pdf size kam',
        'pdf chota',
        'pdf small',
      ],
      requiresFile: true,
      accepts: ['application/pdf'],
      canHandle: ({ input, file }) =>
        Boolean(
          file &&
          (
            file.type === 'application/pdf' ||
            file.name.toLowerCase().endsWith('.pdf')
          ) &&
          /compress|compression|size kam|chota|small/i.test(input),
        ),
      execute: async ({ input, file }) => {
        if (!file) return null

        const mode = getCompressionMode(input)
        const bytes = await file.arrayBuffer()

        const result = await compressPdf(
          bytes,
          file.name,
          mode,
        )

        const originalMb = result.originalSize / 1024 / 1024
        const compressedMb = result.compressedSize / 1024 / 1024

        return {
          text: `PDF processed successfully. Mode: ${mode}. ${result.pageCount} pages. Original ${originalMb.toFixed(2)} MB → Result ${compressedMb.toFixed(2)} MB.`,
          blob: result.blob,
          fileName: result.fileName,
        }
      },
    },
  ],
}
