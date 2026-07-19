import type { AppChatModule } from '@core/chat/types'
import {
  decodeAudioFile,
  audioBufferToWavBlob,
} from './lib/audioProcessing'

export const chatModule: AppChatModule = {
  appId: 'smart-audio-tools',
  actions: [
    {
      id: 'audio-to-wav',
      appId: 'smart-audio-tools',
      label: 'Convert audio to WAV',
      description: 'Convert an attached audio file to WAV.',
      keywords: ['wav', 'convert audio', 'audio convert'],
      requiresFile: true,
      accepts: ['audio/*'],
      canHandle: ({ input, file }) =>
        Boolean(
          file?.type.startsWith('audio/') &&
          /wav|convert audio|audio convert/i.test(input),
        ),
      execute: async ({ file }) => {
        if (!file) return null

        const buffer = await decodeAudioFile(file)

        return {
          text: 'Audio WAV format me convert ho gaya.',
          blob: audioBufferToWavBlob(buffer),
          fileName: `${file.name.replace(/\.[^/.]+$/, '') || 'audio'}.wav`,
        }
      },
    },
  ],
}
