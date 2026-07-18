import type { ProcessingProgress, VideoSettings } from '../types'

let ffmpegInstance: any = null
let loaded = false

async function getFFmpeg(onProgress?: (progress: ProcessingProgress) => void) {
  if (!ffmpegInstance) {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    ffmpegInstance = new FFmpeg()

    ffmpegInstance.on('progress', ({ progress }: { progress: number }) => {
      onProgress?.({
        ratio: Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0,
        message: 'Processing video…',
      })
    })
  }

  if (!loaded) {
    onProgress?.({ ratio: 0, message: 'Loading video engine…' })
    await ffmpegInstance.load()
    loaded = true
  }

  return ffmpegInstance
}

function extensionFromType(type: string) {
  if (type.includes('webm')) return 'webm'
  if (type.includes('quicktime')) return 'mov'
  if (type.includes('matroska')) return 'mkv'
  return 'mp4'
}

export async function processVideo(
  file: File,
  settings: VideoSettings,
  onProgress?: (progress: ProcessingProgress) => void,
): Promise<Blob> {
  const ffmpeg = await getFFmpeg(onProgress)
  const { fetchFile } = await import('@ffmpeg/util')

  const inputExt = extensionFromType(file.type)
  const inputName = `input.${inputExt}`
  const outputName = 'output.mp4'

  await ffmpeg.writeFile(inputName, await fetchFile(file))

  const duration = Math.max(0.1, settings.endTime - settings.startTime)
  const videoFilters: string[] = []

  if (settings.rotate === 90) videoFilters.push('transpose=1')
  if (settings.rotate === 180) videoFilters.push('transpose=1,transpose=1')
  if (settings.rotate === 270) videoFilters.push('transpose=2')

  if (settings.scalePercent !== 100) {
    const scale = Math.max(10, Math.min(100, settings.scalePercent)) / 100
    videoFilters.push(`scale=trunc(iw*${scale}/2)*2:trunc(ih*${scale}/2)*2`)
  }

  if (settings.speed !== 1) {
    videoFilters.push(`setpts=${(1 / settings.speed).toFixed(6)}*PTS`)
  }

  const args = [
    '-ss',
    String(settings.startTime),
    '-i',
    inputName,
    '-t',
    String(duration),
  ]

  if (videoFilters.length) args.push('-vf', videoFilters.join(','))

  if (settings.muted) {
    args.push('-an')
  } else if (settings.speed !== 1) {
    const tempo = Math.max(0.5, Math.min(2, settings.speed))
    args.push('-filter:a', `atempo=${tempo}`)
  }

  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    String(settings.crf),
    '-movflags',
    '+faststart',
    outputName,
  )

  await ffmpeg.exec(args)
  const data = await ffmpeg.readFile(outputName)

  try {
    await ffmpeg.deleteFile(inputName)
    await ffmpeg.deleteFile(outputName)
  } catch {
    // Cleanup failure is harmless.
  }

  onProgress?.({ ratio: 1, message: 'Video ready.' })
  return new Blob([data.buffer], { type: 'video/mp4' })
}

export async function extractAudio(
  file: File,
  startTime: number,
  endTime: number,
  onProgress?: (progress: ProcessingProgress) => void,
): Promise<Blob> {
  const ffmpeg = await getFFmpeg(onProgress)
  const { fetchFile } = await import('@ffmpeg/util')

  const inputExt = extensionFromType(file.type)
  const inputName = `input-audio.${inputExt}`
  const outputName = 'audio.mp3'

  await ffmpeg.writeFile(inputName, await fetchFile(file))

  const duration = Math.max(0.1, endTime - startTime)

  await ffmpeg.exec([
    '-ss',
    String(startTime),
    '-i',
    inputName,
    '-t',
    String(duration),
    '-vn',
    '-codec:a',
    'libmp3lame',
    '-q:a',
    '4',
    outputName,
  ])

  const data = await ffmpeg.readFile(outputName)

  try {
    await ffmpeg.deleteFile(inputName)
    await ffmpeg.deleteFile(outputName)
  } catch {
    // Cleanup failure is harmless.
  }

  onProgress?.({ ratio: 1, message: 'Audio ready.' })
  return new Blob([data.buffer], { type: 'audio/mpeg' })
}
