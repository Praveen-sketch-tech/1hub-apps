import { useState, useRef } from 'react'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'

type PresetKey = 'passport' | 'pan' | 'aadhaar' | 'ssc' | 'upsc' | 'signature' | 'custom'

const PRESETS: Record<PresetKey, { label: string; width: number; height: number; minKB: number; maxKB: number }> = {
  passport: { label: 'Passport Photo', width: 413, height: 531, minKB: 20, maxKB: 50 },
  pan: { label: 'PAN Card Photo', width: 213, height: 213, minKB: 20, maxKB: 50 },
  aadhaar: { label: 'Aadhaar Update Photo', width: 200, height: 230, minKB: 10, maxKB: 20 },
  ssc: { label: 'SSC / Railway Form Photo', width: 100, height: 120, minKB: 20, maxKB: 50 },
  upsc: { label: 'UPSC Photo', width: 200, height: 230, minKB: 20, maxKB: 300 },
  signature: { label: 'Signature', width: 140, height: 60, minKB: 10, maxKB: 20 },
  custom: { label: 'Custom', width: 300, height: 300, minKB: 20, maxKB: 100 },
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
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const active = preset === 'custom'
    ? { label: 'Custom', width: customW, height: customH, minKB: customMinKB, maxKB: customMaxKB }
    : PRESETS[preset]

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setResultUrl(null)
    const reader = new FileReader()
    reader.onload = () => setImgSrc(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function processImage() {
    if (!imgSrc) return
    setProcessing(true)
    setError(null)
    try {
      const img = new Image()
      img.src = imgSrc
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const canvas = document.createElement('canvas')
      canvas.width = active.width
      canvas.height = active.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas not supported')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, active.width, active.height)
      ctx.drawImage(img, 0, 0, active.width, active.height)

      let quality = 0.92
      let blob: Blob | null = null
      for (let i = 0; i < 12; i++) {
        blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
        )
        if (!blob) break
        const sizeKB = blob.size / 1024
        if (sizeKB <= active.maxKB && sizeKB >= active.minKB) break
        if (sizeKB > active.maxKB) {
          quality -= 0.08
          if (quality < 0.1) break
        } else {
          break
        }
      }

      if (!blob) throw new Error('Could not process image')
      const finalKB = blob.size / 1024
      setResultSizeKB(Math.round(finalKB * 10) / 10)
      setResultUrl(URL.createObjectURL(blob))

      if (finalKB > active.maxKB) {
        setError(`Target size reach nahi ho paya (${Math.round(finalKB)}KB vs max ${active.maxKB}KB). Kam pixel wala custom size try karo.`)
      }
    } catch (err) {
      setError('Kuch galat ho gaya, dobara try karo.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <PageContainer>
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Photo & Signature Resizer</h1>
        <p className="max-w-xl text-slate-600 dark:text-slate-400">
          Passport, PAN, Aadhaar, SSC, UPSC photo aur signature ko exact size aur KB range mein resize karo — sab kuch browser mein, koi upload server pe nahi jaata.
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-5">
          <div>
            <label className="mb-1 block text-sm font-medium">Document type</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as PresetKey)}
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
                <input type="number" value={customW} onChange={(e) => setCustomW(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <div>
                <label className="mb-1 block text-sm">Height (px)</label>
                <input type="number" value={customH} onChange={(e) => setCustomH(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <div>
                <label className="mb-1 block text-sm">Min KB</label>
                <input type="number" value={customMinKB} onChange={(e) => setCustomMinKB(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <div>
                <label className="mb-1 block text-sm">Max KB</label>
                <input type="number" value={customMaxKB} onChange={(e) => setCustomMaxKB(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800" />
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500">
            Target: {active.width}×{active.height}px, {active.minKB}–{active.maxKB}KB. (Har form ka exact spec alag ho sakta hai, official notification se verify kar lena.)
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

          {resultUrl && (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
              <img src={resultUrl} alt="result" className="h-32 w-32 rounded-lg border object-cover" />
              <p className="text-sm font-medium">Ready — {resultSizeKB}KB</p>
              <a href={resultUrl} download="resized-photo.jpg">
                <Button>Download</Button>
              </a>
            </div>
          )}
        </div>
      </Card>
    </PageContainer>
  )
}
