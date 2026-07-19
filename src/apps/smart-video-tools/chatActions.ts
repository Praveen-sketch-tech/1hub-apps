import type { AppChatModule } from '@core/chat/types'
import { extractAudio } from './lib/ffmpegProcessor'

async function getDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')

    const cleanup = () => URL.revokeObjectURL(url)

    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      const duration = video.duration
      cleanup()

      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Could not read video duration.'))
      } else {
        resolve(duration)
      }
    }

    video.onerror = () => {
      cleanup()
      reject(new Error('Could not read video file.'))
    }

    video.src = url
  })
}

export const chatModule: AppChatModule = {
  appId: 'smart-video-tools',
  actions: [
    {
      id: 'video-extract-audio',
      appId: 'smart-video-tools',
      label: 'Extract audio from video',
      description: 'Extract MP3 audio from an attached video.',
      keywords: [
        'extract audio',
        'audio extract',
        'video to audio',
        'video se audio',
        'video ka audio',
        'audio nikal',
        'mp3 bana',
      ],
      requiresFile: true,
      accepts: ['video/*'],
      canHandle: ({ input, file }) =>
        Boolean(
          file?.type.startsWith('video/') &&
          /extract audio|audio extract|video to audio|video se audio|video ka audio|audio nikal|mp3 bana/i.test(input),
        ),
      execute: async ({ file }) => {
        if (!file) return null

        const duration = await getDuration(file)
        const blob = await extractAudio(file, 0, duration)

        return {
          text: 'Video se audio successfully extract ho gaya.',
          blob,
          fileName: `${file.name.replace(/\.[^/.]+$/, '') || 'audio'}.mp3`,
        }
      },
    },
  ],
}
