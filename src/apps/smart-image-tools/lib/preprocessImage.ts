import { loadImage } from './imageProcessing'

interface PreparedImage {
  blob: Blob
  width: number
  height: number
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality = 0.96,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Unable to prepare image.'))
        }
      },
      format,
      format === 'image/png' ? undefined : quality,
    )
  })
}

function analyseBrightness(
  data: Uint8ClampedArray,
): number {
  let total = 0
  let count = 0

  // Sample every 16th pixel for speed.
  for (let index = 0; index < data.length; index += 64) {
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]

    total +=
      red * 0.2126 +
      green * 0.7152 +
      blue * 0.0722

    count += 1
  }

  return count ? total / count : 128
}

function applyMildSharpen(
  imageData: ImageData,
): ImageData {
  const { width, height, data } = imageData

  // Skip expensive convolution for extremely large images.
  if (width * height > 12_000_000) {
    return imageData
  }

  const output = new Uint8ClampedArray(data)

  // Mild sharpening kernel:
  //  0   -0.15   0
  // -0.15  1.6  -0.15
  //  0   -0.15   0

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const center = (y * width + x) * 4
      const top = ((y - 1) * width + x) * 4
      const bottom = ((y + 1) * width + x) * 4
      const left = (y * width + x - 1) * 4
      const right = (y * width + x + 1) * 4

      for (let channel = 0; channel < 3; channel += 1) {
        const value =
          data[center + channel] * 1.6 -
          data[top + channel] * 0.15 -
          data[bottom + channel] * 0.15 -
          data[left + channel] * 0.15 -
          data[right + channel] * 0.15

        output[center + channel] =
          Math.max(0, Math.min(255, value))
      }

      output[center + 3] = data[center + 3]
    }
  }

  return new ImageData(output, width, height)
}

/**
 * Lightweight browser-only Auto Correct + Local Enhance.
 *
 * This does not use an API or upload the image anywhere.
 */
export async function autoCorrectAndEnhance(
  inputBlob: Blob,
  preferredFormat: string,
): Promise<PreparedImage> {
  const inputUrl = URL.createObjectURL(inputBlob)

  try {
    const image = await loadImage(inputUrl)

    const width = image.naturalWidth
    const height = image.naturalHeight

    const analysisCanvas = document.createElement('canvas')
    analysisCanvas.width = width
    analysisCanvas.height = height

    const analysisContext =
      analysisCanvas.getContext('2d', {
        willReadFrequently: true,
      })

    if (!analysisContext) {
      throw new Error('Canvas is not supported.')
    }

    analysisContext.drawImage(image, 0, 0, width, height)

    const originalData =
      analysisContext.getImageData(0, 0, width, height)

    const averageBrightness =
      analyseBrightness(originalData.data)

    // Keep correction conservative so faces and documents
    // do not become unnaturally bright.
    const brightness =
      averageBrightness < 85
        ? 1.14
        : averageBrightness < 115
          ? 1.08
          : averageBrightness > 195
            ? 0.94
            : 1

    const contrast =
      averageBrightness < 105
        ? 1.1
        : 1.06

    const correctedCanvas =
      document.createElement('canvas')

    correctedCanvas.width = width
    correctedCanvas.height = height

    const correctedContext =
      correctedCanvas.getContext('2d', {
        willReadFrequently: true,
      })

    if (!correctedContext) {
      throw new Error('Canvas is not supported.')
    }

    correctedContext.imageSmoothingEnabled = true
    correctedContext.imageSmoothingQuality = 'high'

    correctedContext.filter = [
      `brightness(${brightness})`,
      `contrast(${contrast})`,
      'saturate(1.04)',
    ].join(' ')

    correctedContext.drawImage(
      image,
      0,
      0,
      width,
      height,
    )

    correctedContext.filter = 'none'

    const correctedData =
      correctedContext.getImageData(
        0,
        0,
        width,
        height,
      )

    const enhancedData =
      applyMildSharpen(correctedData)

    correctedContext.putImageData(
      enhancedData,
      0,
      0,
    )

    const outputFormat =
      preferredFormat === 'image/png'
        ? 'image/png'
        : preferredFormat === 'image/webp'
          ? 'image/webp'
          : 'image/jpeg'

    const blob = await canvasToBlob(
      correctedCanvas,
      outputFormat,
      0.96,
    )

    return {
      blob,
      width,
      height,
    }
  } finally {
    URL.revokeObjectURL(inputUrl)
  }
}
