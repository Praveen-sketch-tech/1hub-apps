import type { AppChatModule } from '@core/chat/types'
import {
  processImage,
  createOutputFileName,
} from './lib/imageProcessing'

function getPercent(input: string) {
  const match = input.match(/(\d{1,3})\s*%/)
  return Math.max(1, Math.min(100, Number(match?.[1] ?? 70)))
}

export const chatModule: AppChatModule = {
  appId: 'smart-image-tools',
  actions: [
    {
      id: 'image-compress',
      appId: 'smart-image-tools',
      label: 'Compress image',
      description: 'Compress an attached image locally.',
      keywords: ['compress image', 'image compress', 'size kam', 'image chota'],
      requiresFile: true,
      accepts: ['image/*'],
      canHandle: ({ input, file }) =>
        Boolean(
          file?.type.startsWith('image/') &&
          /compress|compression|size kam|chota|small/i.test(input),
        ),
      execute: async ({ input, file }) => {
        if (!file) return null

        const outputFormat =
          file.type === 'image/png'
            ? 'image/png'
            : file.type === 'image/webp'
              ? 'image/webp'
              : 'image/jpeg'

        const sourceUrl = URL.createObjectURL(file)

        try {
          const quality = getPercent(input)

          const result = await processImage({
            sourceUrl,
            outputFormat,
            quality: quality / 100,
          })

          return {
            text: `Image processed successfully. Quality: ${quality}%. Original ${(file.size / 1024 / 1024).toFixed(2)} MB → Result ${(result.blob.size / 1024 / 1024).toFixed(2)} MB.`,
            blob: result.blob,
            fileName: createOutputFileName(file.name, outputFormat),
          }
        } finally {
          URL.revokeObjectURL(sourceUrl)
        }
      },
    },
  ],
}
