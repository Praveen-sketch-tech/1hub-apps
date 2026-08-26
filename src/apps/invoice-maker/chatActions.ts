import type { AppChatModule } from '@core/chat/types'

// Keep processing in reusable lib functions and call the same functions from UI + chat.
export const chatModule: AppChatModule = {
  appId: 'invoice-maker',
  actions: [
    // Add chat-accessible app actions here.
  ],
}
