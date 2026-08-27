/**
 * Auto-enhance = per-channel histogram stretch (auto levels).
 * This brightens washed-out / dim phone-camera photos of documents and
 * boosts contrast slightly. It is NOT AI upscaling or noise removal —
 * kept honest and simple, and it's fast enough to run on every crop.
 */
export function autoEnhanceCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return source

  ctx.drawImage(source, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  let min = 255
  let max = 0
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (luminance < min) min = luminance
    if (luminance > max) max = luminance
  }

  const range = max - min
  // If the image already uses close to the full range, don't touch it —
  // stretching a already-good photo can introduce banding/artifacts.
  if (range < 10 || range > 240) return source

  const scale = 255 / range
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, (data[i] - min) * scale))
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - min) * scale))
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - min) * scale))
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}
