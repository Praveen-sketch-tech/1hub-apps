import { downloadBlob } from '@shared/utils/downloads'
import type { ProcessingOptions } from './types'

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer()
  const context = new AudioContext()
  try {
    return await context.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    await context.close()
  }
}

export function processAudioBuffer(source: AudioBuffer, options: ProcessingOptions): AudioBuffer {
  const sampleRate = source.sampleRate
  const safeStart = Math.max(0, Math.min(options.trimStart, source.duration))
  const safeEnd = Math.max(safeStart, Math.min(options.trimEnd || source.duration, source.duration))
  const startFrame = Math.floor(safeStart * sampleRate)
  const endFrame = Math.max(startFrame + 1, Math.floor(safeEnd * sampleRate))
  const frameCount = Math.max(1, endFrame - startFrame)

  const context = new OfflineAudioContext(source.numberOfChannels, frameCount, sampleRate)
  const output = context.createBuffer(source.numberOfChannels, frameCount, sampleRate)

  const fadeInFrames = Math.min(frameCount, Math.floor(Math.max(0, options.fadeIn) * sampleRate))
  const fadeOutFrames = Math.min(frameCount, Math.floor(Math.max(0, options.fadeOut) * sampleRate))
  const gain = Math.max(0, options.volume)

  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    const input = source.getChannelData(channel)
    const target = output.getChannelData(channel)

    for (let i = 0; i < frameCount; i += 1) {
      let sampleGain = gain
      if (fadeInFrames > 0 && i < fadeInFrames) sampleGain *= i / fadeInFrames
      if (fadeOutFrames > 0 && i >= frameCount - fadeOutFrames) {
        sampleGain *= Math.max(0, (frameCount - i - 1) / fadeOutFrames)
      }
      target[i] = input[startFrame + i] * sampleGain
    }
  }

  return output
}

export function mergeAudioBuffers(buffers: AudioBuffer[]): AudioBuffer {
  if (!buffers.length) throw new Error('No audio buffers to merge.')
  const sampleRate = Math.max(...buffers.map((buffer) => buffer.sampleRate))
  const channels = Math.max(...buffers.map((buffer) => buffer.numberOfChannels))
  const totalFrames = buffers.reduce(
    (sum, buffer) => sum + Math.ceil(buffer.duration * sampleRate),
    0,
  )
  const context = new OfflineAudioContext(channels, totalFrames, sampleRate)
  const merged = context.createBuffer(channels, totalFrames, sampleRate)

  let offset = 0
  for (const buffer of buffers) {
    const frames = Math.ceil(buffer.duration * sampleRate)
    for (let channel = 0; channel < channels; channel += 1) {
      const target = merged.getChannelData(channel)
      const sourceChannel = Math.min(channel, buffer.numberOfChannels - 1)
      const source = buffer.getChannelData(sourceChannel)
      for (let i = 0; i < frames; i += 1) {
        const sourceIndex = Math.min(source.length - 1, Math.floor((i / sampleRate) * buffer.sampleRate))
        target[offset + i] = source[sourceIndex] || 0
      }
    }
    offset += frames
  }
  return merged
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bytesPerSample = 2
  const blockAlign = channels * bytesPerSample
  const dataLength = buffer.length * blockAlign
  const arrayBuffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  let offset = 44
  for (let i = 0; i < buffer.length; i += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i] || 0))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([view], { type: 'audio/wav' })
}



export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const whole = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(whole / 60)
  const remainder = whole % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export { downloadBlob }
