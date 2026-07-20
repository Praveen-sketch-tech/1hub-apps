import type { AppChatModule } from '@core/chat/types'
import {
  createBackgroundOutputName,
  hexToRgb,
  removeFlatBackgroundFromFile,
  type BackgroundMode,
  type OutputFormat,
} from './lib/backgroundProcessing'

function readNumber(input: string, label: string, fallback: number) {
  const match = input.match(new RegExp(`${label}\\s*[:=]?\\s*(\\d{1,3})`, 'i'))
  return match ? Number(match[1]) : fallback
}

function readFormat(input: string): OutputFormat {
  if (/\bwebp\b/i.test(input)) return 'image/webp'
  if (/\bjpe?g\b|\bjpg\b/i.test(input)) return 'image/jpeg'
  return 'image/png'
}

function readBackgroundMode(input: string): BackgroundMode {
  if (/blur(?:red)?\s*(?:background|bg)|background\s*blur/i.test(input)) return 'blur'
  if (/white\s*(?:background|bg)|safed\s*background/i.test(input)) return 'white'
  if (/custom\s*(?:background|bg)|(?:background|bg)\s*#[0-9a-f]{6}/i.test(input)) return 'custom'
  return 'transparent'
}

export const chatModule: AppChatModule = {
  appId: 'smart-image-background-tools',
  actions: [
    {
      id: 'remove-flat-image-background',
      appId: 'smart-image-background-tools',
      label: 'Remove a color-based image background',
      description: 'Remove a mostly flat-color background locally using corner color estimation, tolerance and feather controls.',
      keywords: [
        'remove image background',
        'background remove',
        'bg remove',
        'background hatao',
        'transparent background',
        'white background',
      ],
      requiresFile: true,
      accepts: ['image/*'],
      canHandle: ({ input, file }) => Boolean(
        file?.type.startsWith('image/') &&
        /remove\s*(?:the\s*)?(?:image\s*)?(?:background|bg)|background\s*(?:remove|hata)|bg\s*(?:remove|hata)|transparent\s*background|white\s*background/i.test(input),
      ),
      execute: async ({ input, file }) => {
        if (!file) return null

        const outputFormat = readFormat(input)
        const backgroundMode = readBackgroundMode(input)
        const customHex = input.match(/(?:background|bg)\s*(#[0-9a-f]{6})\b/i)?.[1] ?? '#FFFFFF'
        const tolerance = Math.max(0, Math.min(100, readNumber(input, 'tolerance', 20)))
        const feather = Math.max(0, Math.min(100, readNumber(input, 'feather', 8)))
        const explicitColor = input.match(/(?:remove|key|color)\s*(#[0-9a-f]{6})/i)?.[1]

        const result = await removeFlatBackgroundFromFile(file, {
          targetColor: explicitColor ? hexToRgb(explicitColor) : undefined,
          tolerance,
          feather,
          compose: {
            backgroundMode,
            customColor: customHex,
            blurRadius: Math.max(1, Math.min(48, readNumber(input, 'blur', 18))),
            outputFormat,
            quality: 0.92,
          },
        })

        const jpegNote = outputFormat === 'image/jpeg' && backgroundMode === 'transparent'
          ? ' JPEG does not support transparency, so a white background was used.'
          : ''
        const scaleNote = result.scaled
          ? ' A browser-safe working resolution was used for this large image.'
          : ''

        return {
          text: `Color-based background processing finished locally. Estimated key color: rgb(${Math.round(result.targetColor.r)}, ${Math.round(result.targetColor.g)}, ${Math.round(result.targetColor.b)}), tolerance ${tolerance}, feather ${feather}.${jpegNote}${scaleNote} This is deterministic color removal, not AI subject detection.`,
          blob: result.blob,
          fileName: createBackgroundOutputName(file.name, outputFormat),
        }
      },
    },
  ],
}
