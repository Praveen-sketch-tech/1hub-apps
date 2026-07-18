export type ScanMode = 'original' | 'auto' | 'color' | 'grayscale' | 'bw' | 'high-contrast'
export type OcrLanguage = 'eng' | 'hin' | 'eng+hin'

export interface Point { x: number; y: number }
export interface Quad { tl: Point; tr: Point; br: Point; bl: Point }

export interface ScanSettings {
  brightness: number
  contrast: number
  sharpen: number
  threshold: number
  mode: ScanMode
}

export interface OcrState {
  text: string
  progress: number
  status: 'idle' | 'running' | 'done' | 'error'
  error?: string
}

export interface DocumentPage {
  id: string
  name: string
  sourceUrl: string
  width: number
  height: number
  rotation: number
  quad: Quad
  settings: ScanSettings
  ocr: OcrState
}
