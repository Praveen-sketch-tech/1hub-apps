import type { RecordingQuality } from '../types'

const WEBM_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

export function getSupportedWebmMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return WEBM_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export function getVideoBitrate(
  quality: RecordingQuality = 'high',
  customBitsPerSecond?: number,
): number | undefined {
  if (quality === 'custom') {
    if (!customBitsPerSecond || !Number.isFinite(customBitsPerSecond)) return undefined
    return Math.max(250_000, Math.min(customBitsPerSecond, 50_000_000))
  }

  const map: Record<Exclude<RecordingQuality, 'custom'>, number> = {
    low: 1_500_000,
    standard: 3_000_000,
    high: 6_000_000,
    'very-high': 10_000_000,
  }
  return map[quality]
}

export function isDisplayCaptureSupported(): boolean {
  return Boolean(
    typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function',
  )
}

export function isMediaRecorderSupported(): boolean {
  return typeof MediaRecorder !== 'undefined'
}
