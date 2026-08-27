import { useState, useRef, useCallback } from 'react'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { getAppNumber } from '@core/apps/appRegistry'
import { PresetCropEditor, type CropExporter } from './PresetCropEditor'
import { autoEnhanceCanvas } from './lib/autoEnhance'
import './photo-signature-resizer.css'

type PresetKey = 'passport' | 'pan' | 'aadhaar' | 'ssc' | 'upsc' | 'signature' | 'custom'
type Stage = 'upload' | 'crop' | 'result'

interface Preset {
  label: string
  width: number
  height: number
  suggestedKB: string // informational only — actual target now comes from Auto/Manual control
}

const PRESETS: Record<PresetKey, Preset> = {
  passport: { label: 'Passport Photo', width: 413, height: 531, suggestedKB: '20–50KB' },
  pan: { label: 'PAN Card Photo', width: 213, height: 213, suggestedKB: '20–50KB' },
  aadhaar: { label: 'Aadhaar Update Photo', width: 200, height: 230, suggestedKB: '10–20KB' },
  ssc: { label: 'SSC / Railway Form Photo', width: 100, height: 120, suggestedKB: '20–50KB' },
  upsc: { label: 'UPSC Photo', width: 200, height: 230, suggestedKB: '20–300KB' },
  signature: { label: 'Signature', width: 140, height: 60, suggestedKB: '10–20KB' },
  custom: { label: 'Custom', width: 300, height: 300, suggestedKB: 'aapki marzi' },
}

/**
 * Reusable resize-to-KB-target function (binary search quality + scale-down
 * fallback). Kept outside the component so a future chat action could call
 * the same logic.
 */
async function resizeToTarget(
  sourceCanvas: HTMLCanvasElement,
  target: { width: number; height: number; minKB: number; maxKB: number },
): Promise<{ blob: Blob; achievedKB: number; withinRange: boolean }> {
  const scales = [1, 0.85, 0.7, 0.55, 0.4]
  let best: { blob: Blob; achievedKB: number } | null = null

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
    ctx.drawImage(sourceCanvas, 0, 0, w, h)

    let lo = 0.05
    let hi = 0.95
    let bestBlobAtScale: Blob | null = null

    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', mid))
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
      best = { blob: bestBlobAtScale, achievedKB: kb }
      if (kb <= target.maxKB) break
    }
  }

  if (!best) {
    const w = Math.max(1, Math.round(target.width * 0.4))
    const h = Math.max(1, Math.round(target.height * 0.4))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(sourceCanvas, 0, 0, w, h)
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.4))
    best = { blob, achievedKB: blob.size / 1024 }
  }

  const withinRange = best.achievedKB >= target.minKB && best.achievedKB <= target.maxKB
  return { ...best, withinRange }
}

export function PhotoSignatureResizerPage() {
  const [stage, setStage] = useState<Stage>('upload')
  const [preset, setPreset] = useState<PresetKey>('passport')
  const [customW, setCustomW] = useState(300)
  const [customH, setCustomH] = useState(300)
  const [freeCrop, setFreeCrop] = useState(false)
  const [enhanceOn, setEnhanceOn] = useState(true)

  // Compression control: Auto = 50% of the ORIGINAL uploaded file's size.
  // Manual = user types the exact final KB they want.
  const [compressionMode, setCompressionMode] = useState<'auto' | 'manual'>('auto')
  const [manualKB, setManualKB] = useState('')
  const [originalFileKB, setOriginalFileKB] = useState<number | null>(null)

  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultKB, setResultKB] = useState<number | null>(null)
  const [resultFileName, setResultFileName] = useState('resized-photo.jpg')

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const exporterRef = useRef<CropExporter | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const active: Preset = preset === 'custom' ? { label: 'Custom', width: customW, height: customH, suggestedKB: 'aapki marzi' } : PRESETS[preset]

  // Auto = 50% of original file size (floor of 8KB so it never targets near-zero).
  const autoTargetKB = originalFileKB ? Math.max(8, Math.round(originalFileKB * 0.5)) : null
  const manualKBNumber = manualKB.trim() ? Number(manualKB) : null
  const effectiveTargetKB =
    compressionMode === 'auto' ? autoTargetKB : manualKBNumber && manualKBNumber > 0 ? manualKBNumber : null

  const lockedAspect = freeCrop ? null : active.width / active.height

  const handleExporterReady = useCallback((exporter: CropExporter | null) => {
    exporterRef.current = exporter
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setWarning(null)
    setOriginalFileKB(Math.round((file.size / 1024) * 10) / 10)
    const reader = new FileReader()
    reader.onload = () => {
      setOriginalUrl(reader.result as string)
      setStage('crop')
    }
    reader.onerror = () => setError('File read nahi ho payi, dobara try karo.')
    reader.readAsDataURL(file)
  }

  async function handleConfirmCrop() {
    if (!exporterRef.current) {
      setError('Crop area ready nahi hai, ek second ruk ke dobara try karo.')
      return
    }
    if (!effectiveTargetKB) {
      setError('Target size set nahi ho payi — manual KB daala hai to ek valid number daalo.')
      return
    }
    setProcessing(true)
    setError(null)
    setWarning(null)
    try {
      const { canvas } = await exporterRef.current()
      const finalCanvas = enhanceOn ? autoEnhanceCanvas(canvas) : canvas
      const target = {
        width: active.width,
        height: active.height,
        maxKB: effectiveTargetKB,
        minKB: Math.max(4, Math.round(effectiveTargetKB * 0.8)),
      }
      const result = await resizeToTarget(finalCanvas, target)

      setResultKB(Math.round(result.achievedKB * 10) / 10)
      setResultUrl(URL.createObjectURL(result.blob))
      setResultFileName(preset === 'signature' ? 'signature.jpg' : 'resized-photo.jpg')
      setStage('result')

      if (!result.withinRange) {
        if (result.achievedKB > target.maxKB) {
          setWarning(`Exact ${target.maxKB}KB tak nahi pahuncha (final: ${Math.round(result.achievedKB)}KB) — is photo mein detail zyada hai. Target KB thoda badha ke dekho.`)
        } else {
          setWarning(`File target se chhoti ban gayi (${Math.round(result.achievedKB)}KB).`)
        }
      }
    } catch {
      setError('Kuch galat ho gaya, dobara try karo.')
    } finally {
      setProcessing(false)
    }
  }

  function startOver() {
    setStage('upload')
    setOriginalUrl(null)
    setResultUrl(null)
    setResultKB(null)
    setOriginalFileKB(null)
    setManualKB('')
    setCompressionMode('auto')
    setError(null)
    setWarning(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <PageContainer>
      <div className="tool-page psr-page">
        <ToolAppHeader
          appNumber={getAppNumber('photo-signature-resizer')}
          title="Photo & Signature Resizer"
          description="Passport, PAN, Aadhaar, SSC, UPSC photo aur signature ko exact size aur KB range mein resize karo — sab kuch is browser ke andar hota hai, koi upload kisi server pe nahi jaata."
        />

        <Card>
          <div className="psr-card-inner">
            {/* ── Stage: upload ─────────────────────────────── */}
            {stage === 'upload' && (
              <>
                <div className="psr-field">
                  <label>Document type</label>
                  <select
                    className="psr-select"
                    value={preset}
                    onChange={(e) => setPreset(e.target.value as PresetKey)}
                  >
                    {Object.entries(PRESETS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>

                {preset === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <div className="psr-field">
                      <label>Width (px)</label>
                      <input type="number" className="psr-select" value={customW} onChange={(e) => setCustomW(Number(e.target.value))} />
                    </div>
                    <div className="psr-field">
                      <label>Height (px)</label>
                      <input type="number" className="psr-select" value={customH} onChange={(e) => setCustomH(Number(e.target.value))} />
                    </div>
                  </div>
                )}

                <p className="psr-hint">
                  Target size: {active.width}×{active.height}px. (Typical govt spec: {active.suggestedKB} — final KB
                  aage compression step mein tum khud set karoge.)
                </p>

                <div className="psr-field">
                  <label>Photo ya signature upload karo</label>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="psr-file-input" />
                </div>

                {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              </>
            )}

            {/* ── Stage: crop ───────────────────────────────── */}
            {stage === 'crop' && originalUrl && (
              <>
                <PresetCropEditor
                  imageUrl={originalUrl}
                  aspectRatio={lockedAspect}
                  onExporterReady={handleExporterReady}
                />

                <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={freeCrop} onChange={(e) => setFreeCrop(e.target.checked)} />
                    Free crop (ratio lock hata do)
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={enhanceOn} onChange={(e) => setEnhanceOn(e.target.checked)} />
                    Auto enhance (brightness/contrast)
                  </label>
                </div>

                <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="mb-3 text-sm font-semibold">Compression</p>

                  <label className="mb-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={compressionMode === 'auto'}
                      onChange={(e) => setCompressionMode(e.target.checked ? 'auto' : 'manual')}
                    />
                    Auto — 50% of original size
                    {compressionMode === 'auto' && autoTargetKB && (
                      <span className="text-slate-500">
                        (original {originalFileKB}KB → target ~{autoTargetKB}KB)
                      </span>
                    )}
                  </label>

                  {compressionMode === 'manual' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        className="psr-select"
                        style={{ maxWidth: 140 }}
                        placeholder="e.g. 10"
                        value={manualKB}
                        onChange={(e) => setManualKB(e.target.value)}
                      />
                      <span className="text-sm text-slate-500">KB</span>
                      {manualKBNumber && manualKBNumber > 0 && (
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          → isse ~{manualKBNumber}KB ki file banegi
                        </span>
                      )}
                    </div>
                  )}

                  {compressionMode === 'manual' && !manualKBNumber && (
                    <p className="mt-1 text-xs text-slate-500">KB daalo (jaise 10, 15, 50).</p>
                  )}

                  <p className="mt-2 text-xs text-slate-500">
                    Chhoti KB (jaise 10-15KB) pe detailed photos (QR code, chhota text) ka quality thoda kam dikh sakta hai — yeh compression ka natural trade-off hai.
                  </p>
                </div>

                {error && <p className="text-sm text-red-600 text-center">{error}</p>}

                <div className="flex w-full gap-3">
                  <Button variant="secondary" onClick={startOver} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleConfirmCrop} disabled={processing} className="psr-primary-button flex-[2]">
                    {processing ? 'Processing…' : 'Crop confirm karo & resize karo'}
                  </Button>
                </div>
              </>
            )}

            {/* ── Stage: result ─────────────────────────────── */}
            {stage === 'result' && resultUrl && resultKB !== null && (
              <>
                {warning && <p className="text-sm text-amber-600 dark:text-amber-400 text-center">{warning}</p>}

                <div className="psr-compare-grid">
                  <div className="psr-compare-item">
                    <span className="psr-compare-label">Before</span>
                    {originalUrl && <img src={originalUrl} alt="Original" className="psr-compare-image" />}
                  </div>
                  <div className="psr-compare-item">
                    <span className="psr-compare-label">After — {resultKB}KB</span>
                    <img src={resultUrl} alt="Result" className="psr-compare-image" />
                  </div>
                </div>

                <p className="psr-hint">
                  Final size: {active.width}×{active.height}px, {resultKB}KB
                </p>

                <div className="flex w-full gap-3">
                  <Button variant="secondary" onClick={startOver} className="flex-1">
                    Naya photo
                  </Button>
                  <a href={resultUrl} download={resultFileName} className="flex-[2]">
                    <Button className="psr-primary-button w-full">Download</Button>
                  </a>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}
