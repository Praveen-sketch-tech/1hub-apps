import type { DocumentPage, Point, Quad, ScanSettings } from './types'

export function defaultQuad(width: number, height: number): Quad {
  const insetX = Math.max(4, Math.round(width * 0.025))
  const insetY = Math.max(4, Math.round(height * 0.025))
  return {
    tl: { x: insetX, y: insetY }, tr: { x: width - insetX, y: insetY },
    br: { x: width - insetX, y: height - insetY }, bl: { x: insetX, y: height - insetY },
  }
}

export const DEFAULT_SETTINGS: ScanSettings = {
  brightness: 0, contrast: 0, sharpen: 0, threshold: 155, mode: 'auto',
}


export async function detectDocumentQuad(url: string): Promise<Quad> {
  const img = await loadImage(url)
  const max = 900
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(2, Math.round(img.naturalWidth * scale)), h = Math.max(2, Math.round(img.naturalHeight * scale))
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(img, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data
  const gray = new Uint8Array(w * h)
  for (let i=0,j=0;i<d.length;i+=4,j++) gray[j] = Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2])
  let minX=w, minY=h, maxX=0, maxY=0, count=0
  const threshold = 42
  for (let y=2;y<h-2;y++) for (let x=2;x<w-2;x++) {
    const i=y*w+x; const gx=Math.abs(gray[i+1]-gray[i-1]); const gy=Math.abs(gray[i+w]-gray[i-w])
    if (gx+gy > threshold) { minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y); count++ }
  }
  if (count < w*h*.01 || maxX-minX < w*.3 || maxY-minY < h*.3) return defaultQuad(img.naturalWidth,img.naturalHeight)
  const padX=Math.round((maxX-minX)*.02), padY=Math.round((maxY-minY)*.02)
  minX=Math.max(0,minX-padX); minY=Math.max(0,minY-padY); maxX=Math.min(w,maxX+padX); maxY=Math.min(h,maxY+padY)
  const inv=1/scale
  return {tl:{x:minX*inv,y:minY*inv},tr:{x:maxX*inv,y:minY*inv},br:{x:maxX*inv,y:maxY*inv},bl:{x:minX*inv,y:maxY*inv}}
}

export async function estimateDeskewAngle(page: DocumentPage): Promise<number> {
  const canvas = await renderProcessedPage({...page, rotation:0}, 700)
  const src = canvas.getContext('2d',{willReadFrequently:true})!.getImageData(0,0,canvas.width,canvas.height).data
  const test = (angle:number) => {
    const r=document.createElement('canvas'); r.width=canvas.width; r.height=canvas.height; const rc=r.getContext('2d',{willReadFrequently:true})!
    rc.fillStyle='#fff'; rc.fillRect(0,0,r.width,r.height); rc.translate(r.width/2,r.height/2); rc.rotate(angle*Math.PI/180); rc.drawImage(canvas,-canvas.width/2,-canvas.height/2)
    const data=rc.getImageData(0,0,r.width,r.height).data; const rows=new Float64Array(r.height)
    for(let y=0;y<r.height;y+=2) for(let x=0;x<r.width;x+=2){const i=(y*r.width+x)*4;const g=.299*data[i]+.587*data[i+1]+.114*data[i+2]; if(g<170) rows[y]++}
    let score=0; for(let y=2;y<rows.length;y+=2){const diff=rows[y]-rows[y-2];score+=diff*diff} return score
  }
  void src
  let best=0,bestScore=-1
  for(let a=-5;a<=5;a+=.5){const score=test(a);if(score>bestScore){bestScore=score;best=a}}
  return Math.abs(best)<.4?0:best
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Unable to decode image.'))
    img.src = url
  })
}

function dist(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y) }
function clamp(v: number) { return Math.max(0, Math.min(255, v)) }

function applyPixels(ctx: CanvasRenderingContext2D, w: number, h: number, s: ScanSettings) {
  const image = ctx.getImageData(0, 0, w, h)
  const d = image.data
  const contrast = (259 * (s.contrast + 255)) / (255 * (259 - s.contrast))
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] + s.brightness, g = d[i + 1] + s.brightness, b = d[i + 2] + s.brightness
    r = contrast * (r - 128) + 128; g = contrast * (g - 128) + 128; b = contrast * (b - 128) + 128
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    if (s.mode === 'grayscale') r = g = b = gray
    if (s.mode === 'bw') r = g = b = gray >= s.threshold ? 255 : 0
    if (s.mode === 'high-contrast') { const v = gray > 135 ? 255 : 22; r = g = b = v }
    if (s.mode === 'auto') {
      const v = clamp((gray - 128) * 1.32 + 142)
      r = g = b = v
    }
    if (s.mode === 'color') {
      r = clamp((r - 128) * 1.12 + 132); g = clamp((g - 128) * 1.12 + 132); b = clamp((b - 128) * 1.12 + 132)
    }
    d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b)
  }
  ctx.putImageData(image, 0, 0)

  if (s.sharpen > 0) {
    const source = ctx.getImageData(0, 0, w, h)
    const out = ctx.createImageData(w, h)
    const a = source.data, o = out.data, strength = Math.min(1, s.sharpen / 100)
    const kernel = [0, -strength, 0, -strength, 1 + 4 * strength, -strength, 0, -strength, 0]
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        let sum = 0, k = 0
        for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++, k++) sum += a[((y + ky) * w + x + kx) * 4 + c] * kernel[k]
        o[idx + c] = clamp(sum)
      }
      o[idx + 3] = 255
    }
    ctx.putImageData(out, 0, 0)
  }
}

export async function renderProcessedPage(page: DocumentPage, maxSide?: number): Promise<HTMLCanvasElement> {
  const img = await loadImage(page.sourceUrl)
  const q = page.quad
  const outW0 = Math.max(dist(q.tl, q.tr), dist(q.bl, q.br))
  const outH0 = Math.max(dist(q.tl, q.bl), dist(q.tr, q.br))
  const scale = maxSide && Math.max(outW0, outH0) > maxSide ? maxSide / Math.max(outW0, outH0) : 1
  const outW = Math.max(1, Math.round(outW0 * scale)), outH = Math.max(1, Math.round(outH0 * scale))

  // Lightweight 4-point approximation using triangle affine transforms.
  const canvas = document.createElement('canvas'); canvas.width = outW; canvas.height = outH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const tris: Array<[Point, Point, Point, Point, Point, Point]> = [
    [q.tl, q.tr, q.br, {x:0,y:0},{x:outW,y:0},{x:outW,y:outH}],
    [q.tl, q.br, q.bl, {x:0,y:0},{x:outW,y:outH},{x:0,y:outH}],
  ]
  for (const [s0,s1,s2,d0,d1,d2] of tris) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(d0.x,d0.y); ctx.lineTo(d1.x,d1.y); ctx.lineTo(d2.x,d2.y); ctx.closePath(); ctx.clip()
    const det = s0.x*(s1.y-s2.y)+s1.x*(s2.y-s0.y)+s2.x*(s0.y-s1.y)
    if (Math.abs(det) < 0.0001) { ctx.restore(); continue }
    const a=(d0.x*(s1.y-s2.y)+d1.x*(s2.y-s0.y)+d2.x*(s0.y-s1.y))/det
    const c=(d0.x*(s2.x-s1.x)+d1.x*(s0.x-s2.x)+d2.x*(s1.x-s0.x))/det
    const e=(d0.x*(s1.x*s2.y-s2.x*s1.y)+d1.x*(s2.x*s0.y-s0.x*s2.y)+d2.x*(s0.x*s1.y-s1.x*s0.y))/det
    const b=(d0.y*(s1.y-s2.y)+d1.y*(s2.y-s0.y)+d2.y*(s0.y-s1.y))/det
    const d=(d0.y*(s2.x-s1.x)+d1.y*(s0.x-s2.x)+d2.y*(s1.x-s0.x))/det
    const f=(d0.y*(s1.x*s2.y-s2.x*s1.y)+d1.y*(s2.x*s0.y-s0.x*s2.y)+d2.y*(s0.x*s1.y-s1.x*s0.y))/det
    ctx.setTransform(a,b,c,d,e,f); ctx.drawImage(img,0,0); ctx.restore()
  }
  ctx.setTransform(1,0,0,1,0,0); applyPixels(ctx,outW,outH,page.settings)
  if (page.rotation % 360 !== 0) {
    const r = ((page.rotation % 360) + 360) % 360
    const rotated = document.createElement('canvas'); rotated.width = r % 180 ? outH : outW; rotated.height = r % 180 ? outW : outH
    const rc = rotated.getContext('2d')!; rc.translate(rotated.width/2,rotated.height/2); rc.rotate(r*Math.PI/180); rc.drawImage(canvas,-outW/2,-outH/2)
    return rotated
  }
  return canvas
}

export async function canvasToBlob(canvas: HTMLCanvasElement, type='image/jpeg', quality=0.92): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Export failed.')), type, quality))
}
