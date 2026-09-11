/**
 * Converts an image to grayscale using the standard luminosity formula
 * (0.299R + 0.587G + 0.114B), which matches how the human eye perceives
 * brightness — the same weighting used by most professional imaging tools.
 */
export function toGrayscale(source: HTMLCanvasElement | HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return source as HTMLCanvasElement

  ctx.drawImage(source, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    data[i] = gray
    data[i + 1] = gray
    data[i + 2] = gray
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}
