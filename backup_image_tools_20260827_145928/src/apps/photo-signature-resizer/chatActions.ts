import type { AppChatModule } from '@core/chat/types'

// Keep processing in reusable lib functions and call the same functions from UI + chat.
export const chatModule: AppChatModule = {
  appId: 'photo-signature-resizer',
  actions: [
    // No chat-accessible actions yet — this tool needs a preset + file upload,
    // which is better handled in the UI. Add actions here later if needed.
  ],
}
