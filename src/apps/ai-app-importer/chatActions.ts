import type { AppChatModule } from '@core/chat/types';

export const chatModule: AppChatModule = {
  appId: 'ai-app-importer',
  actions: [
    {
      appId: 'ai-app-importer',
      id: 'generate-app',
      label: 'Generate App',
      description: 'Create a new app package from AI App Importer.',
      keywords: ['generate app', 'create app', 'make app', 'new app'],

      canHandle: (context) =>
        /generate app|create app|make app|new app/i.test(context.input),

      execute: async () => ({
        text: 'AI App Importer Generate App action is connected successfully.'
      })
    },

    {
      appId: 'ai-app-importer',
      id: 'validate-app',
      label: 'Validate App',
      description: 'Validate app files before generation.',
      keywords: ['validate app', 'check app', 'verify app'],

      canHandle: (context) =>
        /validate app|check app|verify app/i.test(context.input),

      execute: async () => ({
        text: 'AI App Importer Validate action is connected successfully.'
      })
    }
  ]
};

export default chatModule;
