import type { CaptureInfo, CaptureOptions } from '../types'

export async function requestDisplayCapture(options: CaptureOptions = {}): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('Screen capture is not supported by this browser.')
  }

  const frameRate = options.frameRate && options.frameRate !== 'auto'
    ? { ideal: options.frameRate, max: options.frameRate }
    : undefined

  const constraints: DisplayMediaStreamOptions = {
    video: frameRate ? { frameRate } : true,
    audio: options.includeAudio ?? false,
  }

  return navigator.mediaDevices.getDisplayMedia(constraints)
}

export function getCaptureInfo(stream: MediaStream): CaptureInfo {
  const videoTrack = stream.getVideoTracks()[0]
  const settings = videoTrack?.getSettings()
  const displaySurface = settings && 'displaySurface' in settings
    ? String((settings as MediaTrackSettings & { displaySurface?: string }).displaySurface ?? '') || undefined
    : undefined

  return {
    width: settings?.width,
    height: settings?.height,
    frameRate: settings?.frameRate,
    displaySurface,
    hasAudio: stream.getAudioTracks().length > 0,
  }
}

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}
