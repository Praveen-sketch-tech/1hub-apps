import type { AppChatModule } from '@core/chat/types'
import { inspectVideo } from './lib/inspectVideo'
import { processEditPlan } from './lib/editPlanProcessor'
import { createDefaultEditPlan, createSource, mutePlan, resizePlan, trimPlan } from './lib/videoProcessing'

const appId = 'browser-video-processing-studio'

function ensureVideo(file?: File | null): File {
  if (!file) throw new Error('Attach a video file first.')
  if (!file.type.startsWith('video/') && !/\.webm$/i.test(file.name)) {
    throw new Error('The attached file is not a supported video.')
  }
  return file
}

async function basePlan(file: File) {
  const metadata = await inspectVideo(file)
  const source = createSource(file)
  return {
    metadata,
    plan: createDefaultEditPlan(source, metadata.duration, metadata.width, metadata.height),
  }
}

function parseTrim(input: string) {
  const match = input.match(/(?:from\s*)?(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds)?\s*(?:to|-)\s*(\d+(?:\.\d+)?)/i)
  return match ? { start: Number(match[1]), end: Number(match[2]) } : null
}

function parseResize(input: string) {
  if (/9\s*:\s*16/i.test(input)) return { width: 720, height: 1280 }
  if (/1\s*:\s*1/i.test(input)) return { width: 1080, height: 1080 }
  if (/16\s*:\s*9/i.test(input)) return { width: 1280, height: 720 }
  const match = input.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i)
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null
}

export const chatModule: AppChatModule = {
  appId,
  actions: [
    {
      id: 'inspect-video',
      appId,
      label: 'Inspect video',
      description: 'Inspect an attached video and report its duration, dimensions, size and MIME type.',
      keywords: ['inspect video', 'video info', 'video metadata', 'duration', 'dimensions'],
      requiresFile: true,
      accepts: ['video/*'],
      canHandle: ({ input, file }) => Boolean(file) && /(inspect|metadata|video info|duration|dimensions)/i.test(input),
      execute: async ({ file }) => {
        const video = ensureVideo(file)
        const info = await inspectVideo(video)
        return {
          text: `${info.name}: ${info.duration.toFixed(2)}s, ${info.width}×${info.height}, ${(info.size / 1024 / 1024).toFixed(2)} MB, ${info.mimeType || 'unknown MIME type'}.`,
        }
      },
    },
    {
      id: 'trim-video',
      appId,
      label: 'Trim video',
      description: 'Trim an attached video to a clearly specified start and end time and export a local WebM result.',
      keywords: ['trim video', 'cut video', 'from seconds to seconds'],
      requiresFile: true,
      accepts: ['video/*'],
      canHandle: ({ input, file }) => Boolean(file) && /(trim|cut)/i.test(input),
      execute: async ({ input, file }) => {
        const video = ensureVideo(file)
        const range = parseTrim(input)
        if (!range || range.end <= range.start) return { text: 'Please specify a valid trim range, for example: trim this video from 3 to 12 seconds.' }
        const { metadata, plan } = await basePlan(video)
        if (range.start < 0 || range.end > metadata.duration) return { text: `The requested range must stay between 0 and ${metadata.duration.toFixed(2)} seconds.` }
        const result = await processEditPlan(trimPlan(plan, range.start, range.end))
        return { text: 'Video trimmed successfully.', blob: result.blob, fileName: 'trimmed-video.webm' }
      },
    },
    {
      id: 'mute-video',
      appId,
      label: 'Mute video',
      description: 'Create a muted browser-local WebM export from an attached video.',
      keywords: ['mute video', 'remove audio', 'silent video'],
      requiresFile: true,
      accepts: ['video/*'],
      canHandle: ({ input, file }) => Boolean(file) && /(mute|remove audio|silent)/i.test(input),
      execute: async ({ file }) => {
        const video = ensureVideo(file)
        const { plan } = await basePlan(video)
        const result = await processEditPlan(mutePlan(plan))
        return { text: 'Muted video exported successfully.', blob: result.blob, fileName: 'muted-video.webm' }
      },
    },
    {
      id: 'resize-video',
      appId,
      label: 'Resize video',
      description: 'Resize an attached video or convert it to 16:9, 9:16 or 1:1 using the reusable local processing engine.',
      keywords: ['resize video', '16:9', '9:16', '1:1', 'aspect ratio'],
      requiresFile: true,
      accepts: ['video/*'],
      canHandle: ({ input, file }) => Boolean(file) && /(resize|aspect|16\s*:\s*9|9\s*:\s*16|1\s*:\s*1|\d{3,4}\s*[x×]\s*\d{3,4})/i.test(input),
      execute: async ({ input, file }) => {
        const video = ensureVideo(file)
        const size = parseResize(input)
        if (!size) return { text: 'Please specify 16:9, 9:16, 1:1, or explicit dimensions such as 1280x720.' }
        const { plan } = await basePlan(video)
        const result = await processEditPlan(resizePlan(plan, size.width, size.height))
        return { text: `Video resized to ${size.width}×${size.height}.`, blob: result.blob, fileName: `resized-${size.width}x${size.height}.webm` }
      },
    },
  ],
}
