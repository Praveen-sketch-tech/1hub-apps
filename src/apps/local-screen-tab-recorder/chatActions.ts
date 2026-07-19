import type { AppChatModule } from '@core/chat/types'

const guidance =
  'Open Local Screen & Tab Recorder to choose a browser tab, window or screen through the browser\'s native permission dialog. Screen capture cannot start silently; after you grant permission, the recorder can manage start, pause, resume and stop locally.'

export const chatModule: AppChatModule = {
  appId: 'local-screen-tab-recorder',
  actions: [
    {
      id: 'prepare-screen-recording',
      appId: 'local-screen-tab-recorder',
      label: 'Start a screen or tab recording',
      description: 'Guide a user into the permission-safe local screen, window or browser-tab recording workflow.',
      keywords: ['record screen', 'record tab', 'record window', 'screen recorder', 'screen capture'],
      canHandle: ({ input }) =>
        /\b(record|capture)\b.*\b(screen|tab|window|display)\b|\b(screen|tab|window)\b.*\b(record|capture)\b/i.test(input),
      execute: async () => ({ text: guidance }),
    },
    {
      id: 'screen-recording-capabilities',
      appId: 'local-screen-tab-recorder',
      label: 'Explain screen recording support',
      description: 'Explain browser permission, audio and capture-source limitations for local screen recording.',
      keywords: ['screen recording audio', 'system audio', 'tab audio', 'screen recording support', 'capture permission'],
      canHandle: ({ input }) =>
        /\b(screen|tab|window)\b.*\b(audio|permission|support|available|possible)\b|\b(system|tab) audio\b/i.test(input),
      execute: async () => ({
        text: 'Screen, window and tab capture depends on browser support and explicit user permission. Tab/system audio is available only when the browser, operating system and selected source provide an audio track; otherwise recording continues as video-only. No extension, server or external API is required.',
      }),
    },
  ],
}
