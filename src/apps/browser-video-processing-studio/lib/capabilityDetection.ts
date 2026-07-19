export interface VideoProcessingCapabilities {
  mediaRecorder: boolean
  canvasCaptureStream: boolean
  audioContext: boolean
  offscreenCanvas: boolean
  webCodecs: boolean
  supportedRecorderMimeTypes: string[]
}

const RECORDER_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

export function detectVideoProcessingCapabilities(): VideoProcessingCapabilities {
  const supportedRecorderMimeTypes =
    typeof MediaRecorder === 'undefined'
      ? []
      : RECORDER_TYPES.filter((type) => MediaRecorder.isTypeSupported(type))

  return {
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    canvasCaptureStream:
      typeof HTMLCanvasElement !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function',
    audioContext:
      typeof AudioContext !== 'undefined' ||
      typeof (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext !== 'undefined',
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    webCodecs: 'VideoEncoder' in globalThis && 'VideoDecoder' in globalThis,
    supportedRecorderMimeTypes,
  }
}

export function chooseRecorderMimeType(preferred?: string): string {
  if (typeof MediaRecorder === 'undefined') return ''
  if (preferred && MediaRecorder.isTypeSupported(preferred)) return preferred
  return RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}
