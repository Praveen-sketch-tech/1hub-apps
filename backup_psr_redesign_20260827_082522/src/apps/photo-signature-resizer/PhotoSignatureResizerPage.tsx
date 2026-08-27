import { useState, useRef } from 'react'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { getAppNumber } from '@core/apps/appRegistry'

type PresetKey = 'passport' | 'pan' | 'aadhaar' | 'ssc' | 'upsc' | 'signature' | 'custom'

interface Preset {
  label: string
  width: number
  height: number
  minKB: number
  maxKB: number
}

const PRESETS: Record<PresetKey, Preset> = {
  passport: { label: 'Passport Photo', width: 413, height: 531, minKB: 20, maxKB: 50 },
  pan: { label: 'PAN Card Photo', width: 213, height: 213, minKB: 20, maxKB: 50 },
  aadhaar: { label: 'Aadhaar Update Photo', width: 200, height: 230, minKB: 10, maxKB: 20 },
  ssc: { label: 'SSC / Railway Form Photo', width: 100, height: 120, minKB: 20, maxKB: 50 },
  upsc: { label: 'UPSC Photo', width: 200, height: 230, minKB: 20, maxKB: 300 },
  signature: { label: 'Signature', width: 140, height: 60, minKB: 10, maxKB: 20 },
  custom: { label: 'Custom', width: 300, height: 300, minKB: 20, maxKB: 100 },
}

/**
 * Reusable processing function — used by the UI here, and available for a future
 * chat action to call the exact same logic (per the tool-app template contract).
 *
 * Strategy: binary-search JPEG quality at the target pixel size. If even the
 * lowest usable quality still exceeds maxKB, progressively shrink the canvas
 * (down to 40% of target pixels) and retry, so we never silently fail on the
 * KB target — we only report the honest achieved size.
 */
async function resizeToTarget(
  img: HTMLImageElement,
  target: { width: number; height: number; minKB: number; maxKB: number },
): Promise<{ blob: Blob; achievedKB: number; scaleUsed: number; withinRange: boolean }> {
  const scales = [1, 0.85, 0.7, 0.55, 0.4]
  let best: { blob: Blob; achievedKB: number; scaleUsed: number } | null = null

  for (const scale of scales) {
    const w = Math.max(1, Math.round(target.width * scale))
    const h = Math.max(1, Math.round(target.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported in this browser')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)

    // Binary search quality between 0.05 and 0.95
    let lo = 0.05
    let hi = 0.95
    let bestBlobAtScale: Blob | null = null

    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', mid),
      )
      if (!blob) break
      const kb = blob.size / 1024

      if (kb > target.maxKB) {
        hi = mid
      } else {
        bestBlobAtScale = blob
        if (kb >= target.minKB) break
        lo = mid
      }
    }

    if (bestBlobAtScale) {
      const kb = bestBlobAtScale.size / 1024
      best = { blob: bestBlobAtScale, achievedKB: kb, scaleUsed: scale }
      if (kb <= target.maxKB) break // good enough, stop shrinking further
    }
  }

  if (!best) {
    // Absolute fallback: smallest scale, lowest quality, whatever size results
    const w = Math.max(1, Math.round(target.width * 0.4))
    const h = Math.max(1, Math.round(target.height * 0.4))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.4),
    )
    best = { blob, achievedKB: blob.size / 1024, scaleUsed: 0.4 }
  }

  const withinRange = best.achievedKB >= target.minKB && best.achievedKB <= target.maxKB
  return { ...best, withinRange }
}

export function PhotoSignatureResizerPage() {
  const [preset, setPreset] = useState<PresetKey>('passport')
  const [customW, setCustomW] = useState(300)
  const [customH, setCustomH] = useState(300)
  const [customMinKB, setCustomMinKB] = useState(20)
  const [customMaxKB, setCustomMaxKB] = useState(100)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultSizeKB, setResultSizeKB] = useState<number | null>(null)
  const [resultScale, setResultScale] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const active: Preset =
    preset === 'custom'
      ? { label: 'Custom', width: customW, height: customH, minKB: customMinKB, maxKB: customMaxKB }
      : PRESETS[preset]

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setWarning(null)
    setResultUrl(null)
    const reader = new FileReader()
    reader.onload = () => setImgSrc(reader.result as string)
    reader.onerror = () => setError('File read nahi ho payi, dobara try karo.')
    reader.readAsDataURL(file)
  }

  async function processImage() {
    if (!imgSrc) return
    setProcessing(true)
    setError(null)
    setWarning(null)
    try {
      const img = new Image()
      img.src = imgSrc
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const result = await resizeToTarget(img, active)

      setResultSizeKB(Math.round(result.achievedKB * 10) / 10)
      setResultScale(result.scaleUsed)
      setResultUrl(URL.createObjectURL(result.blob))

      if (!result.withinRange) {
        if (result.achievedKB > active.maxKB) {
          setWarning(
            `Exact ${active.maxKB}KB limit tak nahi pahuncha (final: ${Math.round(result.achievedKB)}KB). Source photo bahut detailed/high-res hai — chhota crop ya kam-detail wali photo try karo.`,
          )
        } else {
          setWarning(
            `File target se chhoti ban gayi (${Math.round(result.achievedKB)}KB, minimum ${active.minKB}KB chahiye tha). Kuch forms ismein aap ho jaate hain, official spec se verify kar lena.`,
          )
        }
      }
    } catch {
      setError('Kuch galat ho gaya, dobara try karo.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <PageContainer>
      <div className="tool-page">
        <ToolAppHeader
          appNumber={getAppNumber('photo-signature-resizer')}
          title="Photo & Signature Resizer"
          description="Passport, PAN, Aadhaar, SSC, UPSC photo aur signature ko exact size aur KB range mein resize karo — sab kuch is browser ke andar hota hai, koi upload kisi server pe nahi jaata."
        />

        <Card>
          <div className="flex flex-col gap-5">
            <div>
              <label className="mb-1 block text-sm font-medium">Document type</label>
              <select
                value={preset}
                onChange={(e) => {
                  setPreset(e.target.value as PresetKey)
                  setResultUrl(null)
                  setWarning(null)
                }}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
              >
                {Object.entries(PRESETS).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>

            {preset === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm">Width (px)</label>
                  <input
                    type="number"
                    value={customW}
                    onChange={(e) => setCustomW(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Height (px)</label>
                  <input
                    type="number"
                    value={customH}
                    onChange={(e) => setCustomH(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Min KB</label>
                  <input
                    type="number"
                    value={customMinKB}
                    onChange={(e) => setCustomMinKB(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Max KB</label>
                  <input
                    type="number"
                    value={customMaxKB}
                    onChange={(e) => setCustomMaxKB(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500">
              Target: {active.width}×{active.height}px, {active.minKB}–{active.maxKB}KB.
              (Har form ka exact spec alag ho sakta hai — official notification se verify kar lena.)
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium">Photo upload karo</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="w-full text-sm" />
            </div>

            {imgSrc && (
              <div className="flex items-center gap-4">
                <img src={imgSrc} alt="preview" className="h-32 w-32 rounded-lg border border-slate-300 object-cover dark:border-slate-700" />
                <Button onClick={processImage} disabled={processing}>
                  {processing ? 'Processing...' : 'Resize karo'}
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {warning && !error && (
              <p className="text-sm text-amber-600 dark:text-amber-400">{warning}</p>
            )}

            {resultUrl && (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <img src={resultUrl} alt="result" className="h-32 w-32 rounded-lg border object-cover" />
                <p className="text-sm font-medium">
                  Ready — {resultSizeKB}KB
                  {resultScale !== null && resultScale < 1 && (
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      (photo {Math.round(resultScale * 100)}% pixel size par resize hui)
                    </span>
                  )}
                </p>
                <a href={resultUrl} download="resized-photo.jpg">
                  <Button>Download</Button>
                </a>
              </div>
            )}
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}
