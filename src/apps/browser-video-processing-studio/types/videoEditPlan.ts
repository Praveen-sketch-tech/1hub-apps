export type AspectRatioPreset = 'original' | '16:9' | '9:16' | '1:1'
export type FitMode = 'contain' | 'cover' | 'stretch'

export interface VideoSourceRef {
  id: string
  file: File | Blob
  name?: string
  mimeType?: string
}

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface VideoTransform {
  crop?: CropRect
  rotation?: 0 | 90 | 180 | 270
  fit?: FitMode
  background?: string
}

export type VideoTransition = {
  type: 'none' | 'fade'
  duration?: number
}

export interface VideoClip {
  id: string
  sourceId: string
  sourceStart: number
  sourceEnd: number
  transform?: VideoTransform
  transitionIn?: VideoTransition
  transitionOut?: VideoTransition
}

export interface VideoOutputSettings {
  width: number
  height: number
  aspectRatio?: AspectRatioPreset
  frameRate?: number
}

export interface BaseTimedOverlay {
  start: number
  end: number
}

export interface TitleOverlay extends BaseTimedOverlay {
  type: 'title'
  text: string
  subtitle?: string
}

export interface TextOverlay extends BaseTimedOverlay {
  type: 'text'
  text: string
  x?: number
  y?: number
}

export interface CaptionOverlay extends BaseTimedOverlay {
  type: 'caption'
  text: string
  position?: 'top' | 'center' | 'bottom'
}

export interface CursorOverlay extends BaseTimedOverlay {
  type: 'cursor'
  x: number
  y: number
}

export interface ClickOverlay {
  type: 'click'
  time: number
  x: number
  y: number
  duration?: number
}

export interface HighlightOverlay extends BaseTimedOverlay {
  type: 'highlight'
  x: number
  y: number
  width: number
  height: number
  label?: string
}

export type VideoOverlay =
  | TitleOverlay
  | TextOverlay
  | CaptionOverlay
  | CursorOverlay
  | ClickOverlay
  | HighlightOverlay

export interface ZoomEffect extends BaseTimedOverlay {
  type: 'zoom'
  region: CropRect
  scale?: number
}

export interface FocusEffect extends BaseTimedOverlay {
  type: 'focus'
  region: CropRect
}

export interface FadeEffect extends BaseTimedOverlay {
  type: 'fade'
  from?: number
  to?: number
}

export type VideoEffect = ZoomEffect | FocusEffect | FadeEffect

export interface VideoAudioSettings {
  muted: boolean
  volume: number
  preserveSourceAudio: boolean
}

export interface VideoExportSettings {
  mimeType?: string
  videoBitsPerSecond?: number
  audioBitsPerSecond?: number
  fileName?: string
}

export interface VideoEditPlan {
  version: 1
  sources: VideoSourceRef[]
  clips: VideoClip[]
  output: VideoOutputSettings
  overlays: VideoOverlay[]
  effects: VideoEffect[]
  audio: VideoAudioSettings
  export: VideoExportSettings
}

export interface VideoMetadata {
  name: string
  mimeType: string
  size: number
  duration: number
  width: number
  height: number
  aspectRatio: number
  hasAudio: boolean | null
}

export interface ProcessedVideoResult {
  blob: Blob
  fileName: string
  mimeType: string
  duration: number
  width: number
  height: number
}
