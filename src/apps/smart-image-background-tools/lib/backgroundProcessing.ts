export type RGB = { r: number; g: number; b: number }
export type BackgroundMode = 'transparent' | 'white' | 'custom' | 'blur'
export type OutputFormat = 'image/png' | 'image/jpeg' | 'image/webp'

export interface LoadedImage {
  canvas: HTMLCanvasElement
  imageData: ImageData
  originalWidth: number
  originalHeight: number
  scaled: boolean
}

export interface ColorRemovalOptions {
  targetColor: RGB
  tolerance: number
  feather: number
}

export interface ComposeOptions {
  backgroundMode: BackgroundMode
  customColor: string
  blurRadius: number
  outputFormat: OutputFormat
  quality: number
}

const MAX_WORKING_SIDE = 1800
const MAX_COLOR_DISTANCE = Math.sqrt(255 * 255 * 3)

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('This browser could not export the processed image.'))
      },
      format,
      format === 'image/png' ? undefined : clamp(quality, 0.1, 1),
    )
  })
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '').trim()
  const normalized = clean.length === 3
    ? clean.split('').map((part) => `${part}${part}`).join('')
    : clean

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return { r: 255, g: 255, b: 255 }
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }: RGB) {
  const part = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase()
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a supported image file.')
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('The selected image could not be loaded.'))
      element.src = objectUrl
    })

    const originalWidth = image.naturalWidth
    const originalHeight = image.naturalHeight
    const scale = Math.min(1, MAX_WORKING_SIDE / Math.max(originalWidth, originalHeight))
    const width = Math.max(1, Math.round(originalWidth * scale))
    const height = Math.max(1, Math.round(originalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas is not supported in this browser.')

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, width, height)

    return {
      canvas,
      imageData: context.getImageData(0, 0, width, height),
      originalWidth,
      originalHeight,
      scaled: scale < 1,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function createOpaqueMask(imageData: ImageData) {
  const mask = new Uint8ClampedArray(imageData.width * imageData.height)
  mask.fill(255)
  return mask
}

export function createColorMask(
  imageData: ImageData,
  options: ColorRemovalOptions,
) {
  const toleranceDistance = clamp(options.tolerance, 0, 100) / 100 * MAX_COLOR_DISTANCE
  const featherDistance = clamp(options.feather, 0, 100) / 100 * 160
  const mask = new Uint8ClampedArray(imageData.width * imageData.height)
  const { r: targetR, g: targetG, b: targetB } = options.targetColor

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const offset = pixel * 4
    const sourceAlpha = imageData.data[offset + 3]
    if (sourceAlpha === 0) {
      mask[pixel] = 0
      continue
    }

    const red = imageData.data[offset]
    const green = imageData.data[offset + 1]
    const blue = imageData.data[offset + 2]
    const distance = Math.sqrt(
      (red - targetR) ** 2 +
      (green - targetG) ** 2 +
      (blue - targetB) ** 2,
    )

    let alpha = 255
    if (distance <= toleranceDistance) {
      alpha = 0
    } else if (featherDistance > 0 && distance < toleranceDistance + featherDistance) {
      alpha = Math.round(
        ((distance - toleranceDistance) / featherDistance) * 255,
      )
    }

    mask[pixel] = alpha
  }

  return mask
}

export function sampleColor(
  imageData: ImageData,
  x: number,
  y: number,
  radius = 2,
): RGB {
  const centerX = clamp(Math.round(x), 0, imageData.width - 1)
  const centerY = clamp(Math.round(y), 0, imageData.height - 1)
  let red = 0
  let green = 0
  let blue = 0
  let count = 0

  for (let sampleY = Math.max(0, centerY - radius); sampleY <= Math.min(imageData.height - 1, centerY + radius); sampleY += 1) {
    for (let sampleX = Math.max(0, centerX - radius); sampleX <= Math.min(imageData.width - 1, centerX + radius); sampleX += 1) {
      const offset = (sampleY * imageData.width + sampleX) * 4
      if (imageData.data[offset + 3] < 16) continue
      red += imageData.data[offset]
      green += imageData.data[offset + 1]
      blue += imageData.data[offset + 2]
      count += 1
    }
  }

  if (!count) return { r: 255, g: 255, b: 255 }
  return { r: red / count, g: green / count, b: blue / count }
}

export function estimateCornerBackground(imageData: ImageData): RGB {
  const buckets = new Map<string, { red: number; green: number; blue: number; count: number }>()
  const edge = Math.max(2, Math.round(Math.min(imageData.width, imageData.height) * 0.025))
  const points = [
    [edge, edge],
    [imageData.width - 1 - edge, edge],
    [edge, imageData.height - 1 - edge],
    [imageData.width - 1 - edge, imageData.height - 1 - edge],
    [Math.round(imageData.width / 2), edge],
    [Math.round(imageData.width / 2), imageData.height - 1 - edge],
    [edge, Math.round(imageData.height / 2)],
    [imageData.width - 1 - edge, Math.round(imageData.height / 2)],
  ]

  for (const [x, y] of points) {
    const color = sampleColor(imageData, x, y, Math.max(1, Math.round(edge / 2)))
    const qr = Math.round(color.r / 24) * 24
    const qg = Math.round(color.g / 24) * 24
    const qb = Math.round(color.b / 24) * 24
    const key = `${qr}-${qg}-${qb}`
    const existing = buckets.get(key)
    if (existing) {
      existing.red += color.r
      existing.green += color.g
      existing.blue += color.b
      existing.count += 1
    } else {
      buckets.set(key, {
        red: color.r,
        green: color.g,
        blue: color.b,
        count: 1,
      })
    }
  }

  const winner = [...buckets.values()].sort((a, b) => b.count - a.count)[0]
  if (!winner) return { r: 255, g: 255, b: 255 }
  return {
    r: winner.red / winner.count,
    g: winner.green / winner.count,
    b: winner.blue / winner.count,
  }
}

function createMaskedCanvas(
  sourceCanvas: HTMLCanvasElement,
  mask: Uint8ClampedArray,
) {
  const foreground = document.createElement('canvas')
  foreground.width = sourceCanvas.width
  foreground.height = sourceCanvas.height
  const foregroundContext = foreground.getContext('2d')
  if (!foregroundContext) throw new Error('Canvas is not supported in this browser.')
  foregroundContext.drawImage(sourceCanvas, 0, 0)

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = sourceCanvas.width
  maskCanvas.height = sourceCanvas.height
  const maskContext = maskCanvas.getContext('2d')
  if (!maskContext) throw new Error('Canvas is not supported in this browser.')
  const maskImage = maskContext.createImageData(sourceCanvas.width, sourceCanvas.height)

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const offset = pixel * 4
    maskImage.data[offset] = 255
    maskImage.data[offset + 1] = 255
    maskImage.data[offset + 2] = 255
    maskImage.data[offset + 3] = mask[pixel]
  }

  maskContext.putImageData(maskImage, 0, 0)
  foregroundContext.globalCompositeOperation = 'destination-in'
  foregroundContext.drawImage(maskCanvas, 0, 0)
  foregroundContext.globalCompositeOperation = 'source-over'
  return foreground
}

export function renderComposite(
  destination: HTMLCanvasElement,
  sourceCanvas: HTMLCanvasElement,
  sourceImageData: ImageData,
  mask: Uint8ClampedArray,
  options: ComposeOptions,
) {
  destination.width = sourceCanvas.width
  destination.height = sourceCanvas.height
  const context = destination.getContext('2d')
  if (!context) throw new Error('Canvas is not supported in this browser.')

  context.clearRect(0, 0, destination.width, destination.height)

  const effectiveMode = options.outputFormat === 'image/jpeg' && options.backgroundMode === 'transparent'
    ? 'white'
    : options.backgroundMode

  if (effectiveMode === 'white' || effectiveMode === 'custom') {
    context.fillStyle = effectiveMode === 'white' ? '#FFFFFF' : options.customColor
    context.fillRect(0, 0, destination.width, destination.height)
  } else if (effectiveMode === 'blur') {
    context.save()
    context.filter = `blur(${clamp(options.blurRadius, 1, 48)}px)`
    const overscan = Math.max(8, options.blurRadius * 2)
    context.drawImage(
      sourceCanvas,
      -overscan,
      -overscan,
      destination.width + overscan * 2,
      destination.height + overscan * 2,
    )
    context.restore()
  }

  const maskedCanvas = createMaskedCanvas(sourceCanvas, mask)
  context.drawImage(maskedCanvas, 0, 0)
}

export async function exportComposite(
  sourceCanvas: HTMLCanvasElement,
  sourceImageData: ImageData,
  mask: Uint8ClampedArray,
  options: ComposeOptions,
) {
  const output = document.createElement('canvas')
  renderComposite(output, sourceCanvas, sourceImageData, mask, options)
  return canvasToBlob(output, options.outputFormat, options.quality)
}

export async function removeFlatBackgroundFromFile(
  file: File,
  options: Omit<ColorRemovalOptions, 'targetColor'> & {
    targetColor?: RGB
    compose: ComposeOptions
  },
) {
  const loaded = await loadImageFile(file)
  const targetColor = options.targetColor ?? estimateCornerBackground(loaded.imageData)
  const mask = createColorMask(loaded.imageData, {
    targetColor,
    tolerance: options.tolerance,
    feather: options.feather,
  })
  const blob = await exportComposite(
    loaded.canvas,
    loaded.imageData,
    mask,
    options.compose,
  )

  return {
    blob,
    width: loaded.canvas.width,
    height: loaded.canvas.height,
    targetColor,
    scaled: loaded.scaled,
  }
}

export function createBackgroundOutputName(
  originalName: string,
  format: OutputFormat,
) {
  const base = originalName.replace(/\.[^/.]+$/, '') || 'image'
  const extension = format === 'image/jpeg' ? 'jpg' : format.split('/')[1]
  return `${base}-background.${extension}`
}
