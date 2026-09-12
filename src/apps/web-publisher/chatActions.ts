import type { AppChatModule } from '@core/chat/types'

// Web Publisher's actions (upload, preview, publish) all require live
// browser File/DataTransfer objects and a user-entered GitHub token, so
// there is nothing meaningful to expose as a chat-triggerable action yet.
export const chatModule: AppChatModule = {
  appId: 'web-publisher',
  actions: [],
}
