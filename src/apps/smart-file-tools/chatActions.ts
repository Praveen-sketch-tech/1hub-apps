import type { AppChatModule } from '@core/chat/types'
import { sha256File } from './lib/hash'

export const chatModule: AppChatModule = {
  appId: 'app-007-smart-file-tools',
  actions: [
    {
      id: 'file-sha256',
      appId: 'app-007-smart-file-tools',
      label: 'SHA-256 hash',
      description: 'Calculate SHA-256 for an attached file.',
      keywords: ['sha256', 'sha-256', 'hash'],
      requiresFile: true,
      canHandle: ({ input, file }) =>
        Boolean(file && /sha-?256|hash/i.test(input)),
      execute: async ({ file }) => {
        if (!file) return null

        return {
          text: `SHA-256:\n${await sha256File(file)}`,
        }
      },
    },
  ],
}
