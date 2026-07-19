export type VideoSettings = {
  startTime: number
  endTime: number
  rotate: 0 | 90 | 180 | 270
  scalePercent: number
  muted: boolean
  speed: number
  crf: number
}

export type ProcessingProgress = {
  ratio: number
  message: string
}
