import type { PageQualityMetrics, QualityFinding } from './types'

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

function scaledGrayscale(canvas: HTMLCanvasElement, maxSide = 720) {
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height))
  const width = Math.max(1, Math.round(canvas.width * scale))
  const height = Math.max(1, Math.round(canvas.height * scale))
  const sample = document.createElement('canvas')
  sample.width = width
  sample.height = height
  const context = sample.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas pixel analysis is not supported in this browser.')
  context.drawImage(canvas, 0, 0, width, height)
  const rgba = context.getImageData(0, 0, width, height).data
  const gray = new Float32Array(width * height)
  for (let index = 0, pixel = 0; index < rgba.length; index += 4, pixel += 1) {
    gray[pixel] = rgba[index] * 0.2126 + rgba[index + 1] * 0.7152 + rgba[index + 2] * 0.0722
  }
  return { gray, width, height }
}

function blurVariance(gray: Float32Array, width: number, height: number) {
  if (width < 3 || height < 3) return 0
  let sum = 0
  let sumSquares = 0
  let count = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      const laplacian = gray[index - 1] + gray[index + 1] + gray[index - width] + gray[index + width] - 4 * gray[index]
      sum += laplacian
      sumSquares += laplacian * laplacian
      count += 1
    }
  }
  if (!count) return 0
  const mean = sum / count
  return Math.max(0, sumSquares / count - mean * mean)
}

function edgeDensity(gray: Float32Array, width: number, height: number) {
  if (width < 3 || height < 3) return 0
  let edges = 0
  let count = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      const gx = -gray[index - width - 1] - 2 * gray[index - 1] - gray[index + width - 1]
        + gray[index - width + 1] + 2 * gray[index + 1] + gray[index + width + 1]
      const gy = -gray[index - width - 1] - 2 * gray[index - width] - gray[index - width + 1]
        + gray[index + width - 1] + 2 * gray[index + width] + gray[index + width + 1]
      if (Math.hypot(gx, gy) > 95) edges += 1
      count += 1
    }
  }
  return count ? edges / count : 0
}

function estimateSkew(gray: Float32Array, width: number, height: number) {
  const points: Array<{ x: number; y: number }> = []
  const step = Math.max(1, Math.floor(Math.max(width, height) / 500))
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const value = gray[y * width + x]
      if (value < 165) points.push({ x, y })
    }
  }
  if (points.length < 120) return 0
  let bestAngle = 0
  let bestScore = -Infinity
  for (let angle = -7; angle <= 7; angle += 0.5) {
    const radians = angle * Math.PI / 180
    const sin = Math.sin(radians)
    const cos = Math.cos(radians)
    const bins = new Map<number, number>()
    for (const point of points) {
      const projected = Math.round(point.y * cos + point.x * sin)
      bins.set(projected, (bins.get(projected) ?? 0) + 1)
    }
    let sum = 0
    let sumSquares = 0
    for (const value of bins.values()) {
      sum += value
      sumSquares += value * value
    }
    const mean = sum / Math.max(1, bins.size)
    const score = sumSquares / Math.max(1, bins.size) - mean * mean
    if (score > bestScore) {
      bestScore = score
      bestAngle = angle
    }
  }
  return Math.abs(bestAngle) < 0.35 ? 0 : Math.round(bestAngle * 10) / 10
}

export function createPerceptualHash(canvas: HTMLCanvasElement) {
  const sample = document.createElement('canvas')
  sample.width = 9
  sample.height = 8
  const context = sample.getContext('2d', { willReadFrequently: true })
  if (!context) return ''.padStart(64, '0')
  context.drawImage(canvas, 0, 0, 9, 8)
  const data = context.getImageData(0, 0, 9, 8).data
  const values: number[] = []
  for (let index = 0; index < data.length; index += 4) {
    values.push(data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722)
  }
  let bits = ''
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      bits += values[y * 9 + x] > values[y * 9 + x + 1] ? '1' : '0'
    }
  }
  return bits
}

export function hashSimilarity(first: string, second: string) {
  const length = Math.min(first.length, second.length)
  if (!length) return 0
  let distance = 0
  for (let index = 0; index < length; index += 1) if (first[index] !== second[index]) distance += 1
  return 1 - distance / length
}

export function analyzePageCanvas(
  canvas: HTMLCanvasElement,
  pageNumber: number,
  textCharacters: number,
  usedOcr: boolean,
): PageQualityMetrics {
  const { gray, width, height } = scaledGrayscale(canvas)
  let sum = 0
  let sumSquares = 0
  let nearlyWhite = 0
  for (const value of gray) {
    sum += value
    sumSquares += value * value
    if (value > 246) nearlyWhite += 1
  }
  const mean = sum / Math.max(1, gray.length)
  const deviation = Math.sqrt(Math.max(0, sumSquares / Math.max(1, gray.length) - mean * mean))
  const blankRatio = nearlyWhite / Math.max(1, gray.length)
  const edges = edgeDensity(gray, width, height)
  const variance = blurVariance(gray, width, height)
  const skewAngle = estimateSkew(gray, width, height)

  const sharpnessScore = clamp((Math.log10(variance + 1) - 0.55) * 48)
  const contrastScore = clamp((deviation - 8) * 3.2)
  const exposureScore = clamp(100 - Math.abs(mean - 205) * 1.25)
  const contentScore = blankRatio > 0.992 ? 0 : clamp(edges * 1900 + (1 - blankRatio) * 55)
  const skewScore = clamp(100 - Math.abs(skewAngle) * 13)
  const visualScore = Math.round(
    sharpnessScore * 0.34 + contrastScore * 0.24 + exposureScore * 0.18 + contentScore * 0.14 + skewScore * 0.1,
  )

  const findings: QualityFinding[] = []
  const add = (severity: QualityFinding['severity'], code: string, title: string, message: string) => findings.push({
    id: `${pageNumber}-${code}`,
    severity,
    code,
    title,
    message,
    pageNumber,
  })

  if (blankRatio > 0.992 && textCharacters < 12) add('error', 'blank-page', 'Page appears blank', 'Almost the entire page is near-white and no meaningful text was found.')
  else if (blankRatio > 0.975 && textCharacters < 40) add('warning', 'sparse-page', 'Very little visible content', 'The page may be blank, incomplete or captured with too much empty area.')
  if (sharpnessScore < 30) add('error', 'severe-blur', 'Severe blur detected', 'Edges are too soft for reliable reading or OCR.')
  else if (sharpnessScore < 52) add('warning', 'soft-focus', 'Page may be blurry', 'Fine text may be difficult to read or recognize.')
  if (deviation < 18) add('warning', 'low-contrast', 'Low contrast', 'Text and background tones are too similar.')
  if (mean < 75) add('error', 'too-dark', 'Page is too dark', 'The average exposure is very low.')
  else if (mean < 115) add('warning', 'dark-page', 'Page is dark', 'Brightness enhancement may improve readability.')
  if (mean > 248 && blankRatio < 0.992) add('warning', 'overexposed', 'Page may be overexposed', 'Highlights may have removed light text or signatures.')
  if (Math.abs(skewAngle) >= 4) add('error', 'severe-skew', 'Strong page skew', `Estimated document skew is ${skewAngle.toFixed(1)}°.`)
  else if (Math.abs(skewAngle) >= 1.8) add('warning', 'page-skew', 'Page is tilted', `Estimated document skew is ${skewAngle.toFixed(1)}°.`)
  if (canvas.width < 700 || canvas.height < 700) add('warning', 'low-resolution', 'Low page resolution', `Page dimensions are only ${canvas.width}×${canvas.height}px.`)

  return {
    pageNumber,
    width: canvas.width,
    height: canvas.height,
    brightness: Math.round(mean),
    contrast: Math.round(deviation * 10) / 10,
    blankRatio: Math.round(blankRatio * 1000) / 1000,
    edgeDensity: Math.round(edges * 10000) / 10000,
    blurVariance: Math.round(variance * 10) / 10,
    sharpnessScore: Math.round(sharpnessScore),
    skewAngle,
    visualScore,
    perceptualHash: createPerceptualHash(canvas),
    textCharacters,
    usedOcr,
    findings,
  }
}
