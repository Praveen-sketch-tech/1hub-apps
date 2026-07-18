import type { AppChatModule } from '@core/chat/types'
import { generateUuids, parseUuidCount } from './lib/uuid'

export const chatModule: AppChatModule = {
  appId: 'smart-uuid-generator',
  actions: [
    {
      id: 'generate-uuid',
      appId: 'smart-uuid-generator',
      label: 'Generate UUIDs',
      description: 'Generate one or multiple UUID v4 values locally.',
      keywords: [
        'uuid',
        'generate uuid',
        'create uuid',
        'uuid generator',
        'uuid banao',
      ],
      canHandle: ({ input }) =>
        /\buuid(?:s)?\b|uuid generator/i.test(input),
      execute: async ({ input }) => {
        const count = parseUuidCount(input)
        const values = generateUuids(count)
        const output = values.join('\n')

        return {
          text: output,
          blob: new Blob([output], {
            type: 'text/plain;charset=utf-8',
          }),
          fileName: count === 1 ? 'uuid.txt' : `${count}-uuids.txt`,
        }
      },
    },
  ],
}
