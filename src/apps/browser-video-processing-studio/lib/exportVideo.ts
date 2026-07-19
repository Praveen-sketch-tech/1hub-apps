import { chooseRecorderMimeType, detectVideoProcessingCapabilities } from './capabilityDetection'
import { renderVideoFrame } from './frameRenderer'
import { getPlanDuration, validateEditPlan } from './videoProcessing'
import type { ProcessedVideoResult, VideoClip, VideoEditPlan, VideoSourceRef } from '../types/videoEditPlan'

function wait(target: EventTarget, success: string, failure = 'error'): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      cleanup()
      resolve()
    }
    const fail = () => {
      cleanup()
      reject(new Error('Video decoding failed in the current browser.'))
    }
    const cleanup = () => {
      target.removeEventListener(success, ok)
      target.removeEventListener(failure, fail)
    }
    target.addEventListener(success, ok, { once: true })
    target.addEventListener(failure, fail, { once: true })
  })
}

async function loadVideo(source: VideoSourceRef): Promise<{ video: HTMLVideoElement; url: string }> {
  const url = URL.createObjectURL(source.file)
  const video = document.createElement('video')
  video.src = url
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  await wait(video, 'loadedmetadata')
  return { video, url }
}

async function seek(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.01) return
  video.currentTime = Math.max(0, Math.min(time, Number.isFinite(video.duration) ? video.duration : time))
  await wait(video, 'seeked')
}

function findClipAtTime(plan: VideoEditPlan, timelineTime: number): { clip: VideoClip; sourceTime: number } | null {
  let cursor = 0
  for (const clip of plan.clips) {
    const length = Math.max(0, clip.sourceEnd - clip.sourceStart)
    if (timelineTime <= cursor + length || clip === plan.clips[plan.clips.length - 1]) {
      return { clip, sourceTime: clip.sourceStart + Math.max(0, timelineTime - cursor) }
    }
    cursor += length
  }
  return null
}

export async function exportVideo(plan: VideoEditPlan): Promise<ProcessedVideoResult> {
  const errors = validateEditPlan(plan)
  if (errors.length) throw new Error(errors.join(' '))

  const capabilities = detectVideoProcessingCapabilities()
  if (!capabilities.mediaRecorder || !capabilities.canvasCaptureStream) {
    throw new Error('This browser cannot export processed video because MediaRecorder or canvas capture is unavailable.')
  }

  const mimeType = chooseRecorderMimeType(plan.export.mimeType)
  if (!mimeType) throw new Error('No supported WebM recorder codec is available in this browser.')

  const loaded = new Map<string, { video: HTMLVideoElement; url: string }>()
  try {
    for (const source of plan.sources) loaded.set(source.id, await loadVideo(source))

    const canvas = document.createElement('canvas')
    canvas.width = plan.output.width
    canvas.height = plan.output.height
    const fps = Math.max(1, Math.min(60, plan.output.frameRate ?? 30))
    const stream = canvas.captureStream(fps)
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: plan.export.videoBitsPerSecond ?? 6_000_000,
    })
    const chunks: BlobPart[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data)
    }

    const done = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve()
      recorder.onerror = () => reject(new Error('Video export failed.'))
    })

    recorder.start(250)
    const duration = getPlanDuration(plan)
    const startedAt = performance.now()

    await new Promise<void>((resolve, reject) => {
      const tick = async () => {
        try {
          const elapsed = (performance.now() - startedAt) / 1000
          const timelineTime = Math.min(duration, elapsed)
          const match = findClipAtTime(plan, timelineTime)
          if (!match) {
            resolve()
            return
          }
          const loadedSource = loaded.get(match.clip.sourceId)
          if (!loadedSource) throw new Error('A clip references a missing source video.')
          await seek(loadedSource.video, match.sourceTime)
          renderVideoFrame({
            canvas,
            video: loadedSource.video,
            time: timelineTime,
            transform: match.clip.transform,
            overlays: plan.overlays,
            effects: plan.effects,
            background: match.clip.transform?.background,
          })
          if (elapsed >= duration) {
            resolve()
            return
          }
          requestAnimationFrame(() => void tick())
        } catch (error) {
          reject(error)
        }
      }
      void tick()
    })

    recorder.stop()
    await done
    stream.getTracks().forEach((track) => track.stop())

    const blob = new Blob(chunks, { type: mimeType })
    return {
      blob,
      fileName: plan.export.fileName || 'processed-video.webm',
      mimeType,
      duration,
      width: plan.output.width,
      height: plan.output.height,
    }
  } finally {
    for (const { video, url } of loaded.values()) {
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
    }
  }
}
