import { useState, useRef, useCallback, useEffect } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { PresetCropEditor, type CropExporter } from '../PresetCropEditor'
import { autoEnhanceCanvas } from '../lib/autoEnhance'

type PresetKey = 'passport' | 'pan' | 'aadhaar' | 'ssc' | 'upsc' | 'signature' | 'custom'
type Stage = 'upload' | 'crop' | 'adjust'

interface Preset {
  label: string
  width: number
  height: number
  suggestedKB: string
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

export function DocumentsPanel() {
  const [stage, setStage] = useState<Stage>('upload')
  const [preset, setPreset] = useState<PresetKey>('passport')
  const [customW, setCustomW] = useState(300)
  const [customH, setCustomH] = useState(300)
  const [freeCrop, setFreeCrop] = useState(false)
  const [enhanceOn, setEnhanceOn] = useState(true)

  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [croppedCanvas, setCroppedCanvas] = useState<HTMLCanvasElement | null>(null)

  // Direct quality control — same model as the Compress tab. 100% = best
  // natural quality at this pixel size, no artificial KB-target throttling.
  const [quality, setQuality] = useState(0.9)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewKB, setPreviewKB] = useState<number | null>(null)
  const [encoding, setEncoding] = useState(false)

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exporterRef = useRef<CropExporter | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const active: Preset = preset === 'custom' ? { label: 'Custom', width: customW, height: customH, suggestedKB: 'aapki marzi' } : PRESETS[preset]
  const lockedAspect = freeCrop ? null : active.width / active.height

  const handleExporterReady = useCallback((exporter: CropExporter | null) => {
    exporterRef.current = exporter
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
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
    setProcessing(true)
    setError(null)
    try {
      const { canvas } = await exporterRef.current()
      const finalCanvas = enhanceOn ? autoEnhanceCanvas(canvas) : canvas
      setCroppedCanvas(finalCanvas)
      setQuality(0.9)
      setStage('adjust')
    } catch {
      setError('Kuch galat ho gaya, dobara try karo.')
    } finally {
      setProcessing(false)
    }
  }

  const runEncode = useCallback((canvas: HTMLCanvasElement, q: number) => {
    setEncoding(true)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setEncoding(false)
          return
        }
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return URL.createObjectURL(blob)
        })
        setPreviewKB(Math.round((blob.size / 1024) * 10) / 10)
        setEncoding(false)
      },
      'image/jpeg',
      q,
    )
  }, [])

  useEffect(() => {
    if (!croppedCanvas) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runEncode(croppedCanvas, quality), 120)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [croppedCanvas, quality, runEncode])

  function startOver() {
    setStage('upload')
    setOriginalUrl(null)
    setCroppedCanvas(null)
    setPreviewUrl(null)
    setPreviewKB(null)
    setQuality(0.9)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <Card>
      <div className="psr-card-inner">
        {stage === 'upload' && (
          <>
            <div className="psr-field">
              <label>Document type</label>
              <select className="psr-select" value={preset} onChange={(e) => setPreset(e.target.value as PresetKey)}>
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
              Target size: {active.width}×{active.height}px. (Typical govt spec: {active.suggestedKB} —
              agle step mein quality slider se apni marzi ka size set karoge.)
            </p>

            <div className="psr-field">
              <label>Photo ya signature upload karo</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="psr-file-input" />
            </div>

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          </>
        )}

        {stage === 'crop' && originalUrl && (
          <>
            <PresetCropEditor imageUrl={originalUrl} aspectRatio={lockedAspect} onExporterReady={handleExporterReady} />

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

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            <div className="flex w-full gap-3">
              <Button variant="secondary" onClick={startOver} className="flex-1">Cancel</Button>
              <Button onClick={handleConfirmCrop} disabled={processing} className="psr-primary-button flex-[2]">
                {processing ? 'Processing…' : 'Crop confirm karo'}
              </Button>
            </div>
          </>
        )}

        {stage === 'adjust' && croppedCanvas && (
          <>
            <div className="psr-compare-grid">
              <div className="psr-compare-item">
                <span className="psr-compare-label">Before</span>
                {originalUrl && <img src={originalUrl} alt="Original" className="psr-compare-image" />}
              </div>
              <div className="psr-compare-item">
                <span className="psr-compare-label">
                  Live preview {previewKB !== null && `— ${previewKB}KB`} {encoding && '…'}
                </span>
                {previewUrl && <img src={previewUrl} alt="Result preview" className="psr-compare-image" />}
              </div>
            </div>

            <div className="psr-field">
              <label>
                Quality: {Math.round(quality * 100)}%
                {quality >= 0.95 && <span className="text-slate-500 font-normal"> (best natural quality)</span>}
              </label>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full"
              />
              <p className="psr-hint">
                Slider drag karte hi preview + size turant update hoti hai. {active.width}×{active.height}px pe fixed hai (govt spec).
              </p>
            </div>

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            <div className="flex w-full gap-3">
              <Button variant="secondary" onClick={startOver} className="flex-1">Naya photo</Button>
              {previewUrl && (
                <a href={previewUrl} download={preset === 'signature' ? 'signature.jpg' : 'resized-photo.jpg'} className="flex-[2]">
                  <Button className="psr-primary-button w-full">Download</Button>
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
