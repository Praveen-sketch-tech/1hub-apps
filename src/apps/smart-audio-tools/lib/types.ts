export type AudioItem = {
  id: string
  file: File
  buffer: AudioBuffer
  objectUrl: string
  duration: number
}

export type ProcessingOptions = {
  trimStart: number
  trimEnd: number
  volume: number
  fadeIn: number
  fadeOut: number
}
