export type RecordingState =
  | 'idle'
  | 'requesting-permission'
  | 'ready'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'error'

export type FrameRatePreference = 'auto' | 15 | 24 | 30 | 60
export type RecordingQuality = 'low' | 'standard' | 'high' | 'very-high' | 'custom'

export interface CaptureOptions {
  frameRate?: FrameRatePreference
  includeAudio?: boolean
}

export interface RecordingOptions {
  quality?: RecordingQuality
  videoBitsPerSecond?: number
}

export interface CaptureInfo {
  width?: number
  height?: number
  frameRate?: number
  displaySurface?: string
  hasAudio: boolean
}

export interface RecordedVideoResult extends CaptureInfo {
  blob: Blob
  mimeType: string
  fileName: string
  durationMs: number
  size: number
  createdAt: string
}

export interface RecorderSnapshot {
  state: RecordingState
  elapsedMs: number
  captureInfo: CaptureInfo | null
  error: string | null
}
