import type { VideoMetadata } from '../types/videoEditPlan'

function waitForEvent(target: EventTarget, eventName: string, errorName = 'error'): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSuccess = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Unable to read this video in the current browser.'))
    }
    const cleanup = () => {
      target.removeEventListener(eventName, onSuccess)
      target.removeEventListener(errorName, onError)
    }
    target.addEventListener(eventName, onSuccess, { once: true })
    target.addEventListener(errorName, onError, { once: true })
  })
}

export async function inspectVideo(file: File | Blob, name = 'video'): Promise<VideoMetadata> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.src = url

  try {
    await waitForEvent(video, 'loadedmetadata')
    const width = video.videoWidth || 0
    const height = video.videoHeight || 0
    const duration = Number.isFinite(video.duration) ? video.duration : 0

    return {
      name: file instanceof File ? file.name : name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      duration,
      width,
      height,
      aspectRatio: width && height ? width / height : 0,
      hasAudio: null,
    }
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
