import type { AppChatModule } from '@core/chat/types';

export const chatModule: AppChatModule = {
  appId: 'simple-notes',
  actions: [
    {
      id: 'add-note',
      appId: 'simple-notes',
      label: 'Add Note',
      description: 'Open Simple Notes to add a new note.',
      keywords: ['note', 'notes', 'add note', 'simple notes'],
      canHandle: (context) =>
        /(add note|new note|note|simple notes)/i.test(context.input),
      execute: async () => ({
        text: 'Open the Simple Notes app to create and manage your notes.',
      }),
    },
  ],
};

export default chatModule;
