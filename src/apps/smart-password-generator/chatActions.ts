import type { AppChatModule } from '@core/chat/types'
import {
  generatePassword,
  parsePasswordLength,
} from './lib/password'

export const chatModule: AppChatModule = {
  appId: 'smart-password-generator',
  actions: [
    {
      id: 'generate-password',
      appId: 'smart-password-generator',
      label: 'Generate strong password',
      description: 'Generate a secure random password locally in the browser.',
      keywords: [
        'generate password',
        'strong password',
        'random password',
        'password banao',
        'password bana',
      ],
      canHandle: ({ input }) =>
        /generate.*password|strong password|random password|password (?:banao|bana)/i.test(
          input,
        ),
      execute: ({ input }) => {
        const length = parsePasswordLength(input, 20)

        const password = generatePassword({
          length,
          uppercase: true,
          lowercase: true,
          numbers: true,
          symbols: true,
        })

        return {
          text: `Generated ${length}-character strong password:\n${password}`,
        }
      },
    },
  ],
}
