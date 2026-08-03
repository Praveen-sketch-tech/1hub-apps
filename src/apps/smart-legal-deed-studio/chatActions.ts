import type { AppChatModule } from '@core/chat/types';

export const chatModule: AppChatModule = {
  appId: 'smart-legal-deed-studio',
  actions: [
    {
      appId: 'smart-legal-deed-studio',
      id: 'open-app',
      label: 'Open App',
      description: 'Open and get help with this app.',
      keywords: ['open app', 'help', 'use app'],
      canHandle: (context) => /open app|help|use app/i.test(context.input),
      execute: async () => ({
        text: 'Smart Business Contract & Legal Deed Studio chat action is connected successfully.'
      })
    }
  ],
};
