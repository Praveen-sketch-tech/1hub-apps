import type {
  CropRect,
  VideoEffect,
  VideoOverlay,
  VideoTransform,
} from '../types/videoEditPlan'

export interface FrameRenderOptions {
  canvas: HTMLCanvasElement
  video: HTMLVideoElement
  time: number
  transform?: VideoTransform
  overlays?: VideoOverlay[]
  effects?: VideoEffect[]
  background?: string
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function resolveNormalizedRect(rect: CropRect, width: number, height: number) {
  return {
    x: clamp01(rect.x) * width,
    y: clamp01(rect.y) * height,
    width: clamp01(rect.width) * width,
    height: clamp01(rect.height) * height,
  }
}

function activeAt(time: number, start: number, end: number) {
  return time >= start && time <= end
}

export function renderVideoFrame({
  canvas,
  video,
  time,
  transform,
  overlays = [],
  effects = [],
  background = '#000000',
}: FrameRenderOptions): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D rendering is unavailable.')

  const cw = canvas.width
  const ch = canvas.height
  const vw = video.videoWidth || cw
  const vh = video.videoHeight || ch

  ctx.save()
  ctx.clearRect(0, 0, cw, ch)
  ctx.fillStyle = transform?.background || background
  ctx.fillRect(0, 0, cw, ch)

  const zoom = effects.find((effect) => effect.type === 'zoom' && activeAt(time, effect.start, effect.end))
  const crop = zoom?.type === 'zoom' ? zoom.region : transform?.crop
  const source = crop
    ? resolveNormalizedRect(crop, vw, vh)
    : { x: 0, y: 0, width: vw, height: vh }

  const fit = transform?.fit ?? 'contain'
  let dw = cw
  let dh = ch
  if (fit !== 'stretch') {
    const sourceRatio = source.width / source.height
    const targetRatio = cw / ch
    if ((fit === 'contain' && sourceRatio > targetRatio) || (fit === 'cover' && sourceRatio < targetRatio)) {
      dh = cw / sourceRatio
    } else {
      dw = ch * sourceRatio
    }
  }
  const dx = (cw - dw) / 2
  const dy = (ch - dh) / 2

  const rotation = transform?.rotation ?? 0
  if (rotation) {
    ctx.translate(cw / 2, ch / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    const swap = rotation === 90 || rotation === 270
    ctx.drawImage(video, source.x, source.y, source.width, source.height, -((swap ? dh : dw) / 2), -((swap ? dw : dh) / 2), swap ? dh : dw, swap ? dw : dh)
  } else {
    ctx.drawImage(video, source.x, source.y, source.width, source.height, dx, dy, dw, dh)
  }
  ctx.restore()

  for (const overlay of overlays) {
    if (overlay.type === 'click') {
      const duration = overlay.duration ?? 0.6
      if (time >= overlay.time && time <= overlay.time + duration) {
        const progress = (time - overlay.time) / duration
        ctx.beginPath()
        ctx.lineWidth = Math.max(2, cw * 0.003)
        ctx.strokeStyle = `rgba(255,255,255,${1 - progress})`
        ctx.arc(overlay.x * cw, overlay.y * ch, 12 + progress * 28, 0, Math.PI * 2)
        ctx.stroke()
      }
      continue
    }
    if (!activeAt(time, overlay.start, overlay.end)) continue

    if (overlay.type === 'title') {
      ctx.fillStyle = 'rgba(0,0,0,0.68)'
      ctx.fillRect(0, 0, cw, ch)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.font = `700 ${Math.max(28, Math.round(cw * 0.05))}px sans-serif`
      ctx.fillText(overlay.text, cw / 2, ch / 2)
      if (overlay.subtitle) {
        ctx.font = `400 ${Math.max(16, Math.round(cw * 0.024))}px sans-serif`
        ctx.fillText(overlay.subtitle, cw / 2, ch / 2 + Math.max(36, ch * 0.08))
      }
    } else if (overlay.type === 'caption') {
      const y = overlay.position === 'top' ? ch * 0.12 : overlay.position === 'center' ? ch * 0.5 : ch * 0.88
      ctx.font = `600 ${Math.max(18, Math.round(cw * 0.027))}px sans-serif`
      ctx.textAlign = 'center'
      const metrics = ctx.measureText(overlay.text)
      const pad = 18
      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      ctx.fillRect((cw - metrics.width) / 2 - pad, y - 34, metrics.width + pad * 2, 48)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(overlay.text, cw / 2, y)
    } else if (overlay.type === 'text') {
      ctx.font = `600 ${Math.max(18, Math.round(cw * 0.025))}px sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.fillText(overlay.text, (overlay.x ?? 0.05) * cw, (overlay.y ?? 0.1) * ch)
    } else if (overlay.type === 'cursor') {
      const x = overlay.x * cw
      const y = overlay.y * ch
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 10, y + 28)
      ctx.lineTo(x + 16, y + 17)
      ctx.lineTo(x + 27, y + 16)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    } else if (overlay.type === 'highlight') {
      ctx.lineWidth = Math.max(3, cw * 0.004)
      ctx.strokeStyle = '#ffffff'
      ctx.strokeRect(overlay.x * cw, overlay.y * ch, overlay.width * cw, overlay.height * ch)
      if (overlay.label) {
        ctx.font = `600 ${Math.max(14, Math.round(cw * 0.02))}px sans-serif`
        ctx.fillStyle = '#ffffff'
        ctx.fillText(overlay.label, overlay.x * cw, overlay.y * ch - 8)
      }
    }
  }
}
