import { processImage, createOutputFileName } from '@apps/smart-image-tools/lib/imageProcessing'
import {
  decodeAudioFile,
  audioBufferToWavBlob,
} from '@apps/smart-audio-tools/lib/audioProcessing'
import { extractAudio } from '@apps/smart-video-tools/lib/ffmpegProcessor'
import { sha256File } from '@apps/smart-file-tools/lib/hash'
import { calculateEmi } from '@apps/smart-calculator-converter/lib/finance'
import {
  convertValue,
  type ConverterType,
} from '@apps/smart-calculator-converter/lib/converters'

export interface ChatExecutionResult {
  text: string
  blob?: Blob
  fileName?: string
}

function normalize(input: string) {
  return input.trim().toLowerCase()
}

function extractPercent(input: string, fallback = 70) {
  const match = input.match(/(\d{1,3})\s*%/)
  if (!match) return fallback

  return Math.max(1, Math.min(100, Number(match[1])))
}

function getImageFormat(file: File): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (file.type === 'image/png') return 'image/png'
  if (file.type === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

async function getMediaDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const element = document.createElement(
      file.type.startsWith('video/') ? 'video' : 'audio',
    )

    const cleanup = () => {
      URL.revokeObjectURL(url)
      element.remove()
    }

    element.preload = 'metadata'

    element.onloadedmetadata = () => {
      const duration = element.duration
      cleanup()

      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Could not read media duration.'))
        return
      }

      resolve(duration)
    }

    element.onerror = () => {
      cleanup()
      reject(new Error('Could not read the media file.'))
    }

    element.src = url
  })
}

function parseEmi(input: string): ChatExecutionResult | null {
  const normalized = normalize(input)

  if (!normalized.includes('emi')) {
    return null
  }

  const numbers = [...input.matchAll(/[\d,.]+/g)]
    .map((match) => Number(match[0].replace(/,/g, '')))
    .filter(Number.isFinite)

  if (numbers.length < 3) {
    return {
      text: 'EMI calculate karne ke liye amount, annual interest rate aur tenure months me batao. Example: EMI for 500000 at 10% for 60 months.',
    }
  }

  const [principal, annualRate, months] = numbers
  const emi = calculateEmi(principal, annualRate, months)

  return {
    text: `Estimated EMI: ₹${emi.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    })} per month.`,
  }
}

function parseUnitConversion(input: string): ChatExecutionResult | null {
  const normalized = normalize(input)

  const types: ConverterType[] = [
    'length',
    'weight',
    'temperature',
    'speed',
    'storage',
  ]

  const aliases: Record<string, string> = {
    km: 'kilometer',
    kms: 'kilometer',
    m: 'meter',
    cm: 'centimeter',
    mm: 'millimeter',
    ft: 'foot',
    feet: 'foot',
    miles: 'mile',
    kg: 'kilogram',
    kgs: 'kilogram',
    g: 'gram',
    lbs: 'pound',
    c: 'Celsius',
    f: 'Fahrenheit',
    k: 'Kelvin',
  }

  const match = normalized.match(
    /(-?\d+(?:\.\d+)?)\s*([a-zA-Z/]+)\s+(?:to|in|into)\s+([a-zA-Z/]+)/,
  )

  if (!match) {
    return null
  }

  const value = Number(match[1])
  const fromRaw = aliases[match[2]] ?? match[2]
  const toRaw = aliases[match[3]] ?? match[3]

  for (const type of types) {
    try {
      const result = convertValue(type, value, fromRaw, toRaw)

      if (Number.isFinite(result)) {
        return {
          text: `${value} ${fromRaw} = ${result.toLocaleString('en-IN', {
            maximumFractionDigits: 6,
          })} ${toRaw}`,
        }
      }
    } catch {
      // Try next converter type.
    }
  }

  return null
}

export async function executeChatRequest(
  input: string,
  file?: File,
): Promise<ChatExecutionResult | null> {
  const normalized = normalize(input)

  // -----------------------------------------------
  // Image compression
  // -----------------------------------------------
  if (
    file?.type.startsWith('image/') &&
    (
      normalized.includes('compress') ||
      normalized.includes('compression') ||
      normalized.includes('size kam') ||
      normalized.includes('chota') ||
      normalized.includes('small')
    )
  ) {
    const qualityPercent = extractPercent(input, 70)
    const outputFormat = getImageFormat(file)
    const sourceUrl = URL.createObjectURL(file)

    try {
      const result = await processImage({
        sourceUrl,
        outputFormat,
        quality: qualityPercent / 100,
      })

      return {
        text: `Image processed successfully. Quality: ${qualityPercent}%. Original ${(file.size / 1024 / 1024).toFixed(2)} MB → Result ${(result.blob.size / 1024 / 1024).toFixed(2)} MB.`,
        blob: result.blob,
        fileName: createOutputFileName(file.name, outputFormat),
      }
    } finally {
      URL.revokeObjectURL(sourceUrl)
    }
  }

  // -----------------------------------------------
  // Video -> Audio
  // English + Hinglish aliases
  // -----------------------------------------------
  if (
    file?.type.startsWith('video/') &&
    (
      normalized.includes('extract audio') ||
      normalized.includes('audio extract') ||
      normalized.includes('video to audio') ||
      normalized.includes('video se audio') ||
      normalized.includes('video ka audio') ||
      normalized.includes('audio nikal') ||
      normalized.includes('mp3 bana')
    )
  ) {
    const duration = await getMediaDuration(file)

    const blob = await extractAudio(
      file,
      0,
      duration,
    )

    return {
      text: 'Video se audio successfully extract ho gaya.',
      blob,
      fileName: `${file.name.replace(/\.[^/.]+$/, '') || 'audio'}.mp3`,
    }
  }

  // -----------------------------------------------
  // Audio -> WAV
  // -----------------------------------------------
  if (
    file?.type.startsWith('audio/') &&
    (
      normalized.includes('wav') ||
      normalized.includes('convert audio') ||
      normalized.includes('audio convert')
    )
  ) {
    const buffer = await decodeAudioFile(file)
    const blob = audioBufferToWavBlob(buffer)

    return {
      text: 'Audio WAV format me convert ho gaya.',
      blob,
      fileName: `${file.name.replace(/\.[^/.]+$/, '') || 'audio'}.wav`,
    }
  }

  // -----------------------------------------------
  // SHA-256
  // -----------------------------------------------
  if (
    file &&
    (
      normalized.includes('sha256') ||
      normalized.includes('sha-256') ||
      normalized.includes('hash')
    )
  ) {
    const hash = await sha256File(file)

    return {
      text: `SHA-256:\n${hash}`,
    }
  }

  // -----------------------------------------------
  // EMI
  // -----------------------------------------------
  const emi = parseEmi(input)

  if (emi) {
    return emi
  }

  // -----------------------------------------------
  // Unit conversion
  // -----------------------------------------------
  const conversion = parseUnitConversion(input)

  if (conversion) {
    return conversion
  }

  return null
}
