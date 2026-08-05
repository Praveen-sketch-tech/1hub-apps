import type { AppChatModule } from '@core/chat/types';

// Keep processing in reusable lib functions and call the same functions from the UI + chat.
export const chatModule: AppChatModule = {
  appId: 'zip2text-studio',
  actions: [
    // Add chat-accessible app actions here.
  ],
};
