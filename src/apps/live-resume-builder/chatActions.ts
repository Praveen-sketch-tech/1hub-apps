import type { AppChatModule } from '@core/chat/types';

export const chatModule: AppChatModule = {
  appId: 'live-resume-builder',
  actions: [
    {
      appId: 'live-resume-builder',
      id: 'open-app',
      label: 'Open App',
      description: 'Open and get help with this app.',
      keywords: ['open app', 'help', 'use app'],
      canHandle: (context) => /open app|help|use app/i.test(context.input),
      execute: async () => ({
        text: 'Live Resume & Portfolio Studio chat action is connected successfully.'
      })
    }
  ],
};
