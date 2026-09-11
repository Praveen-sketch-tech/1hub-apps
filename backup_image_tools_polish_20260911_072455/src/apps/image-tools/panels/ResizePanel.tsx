import { useState, useRef, useEffect } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { processImage, loadImage } from '@apps/smart-image-tools/lib/imageProcessing'

type Mode = 'percent' | 'pixels'

export function ResizePanel() {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [naturalW, setNaturalW] = useState(0)
  const [naturalH, setNaturalH] = useState(0)
  const [mode, setMode] = useState<Mode>('percent')
  const [percent, setPercent] = useState(50)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [lockAspect, setLockAspect] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewKB, setPreviewKB] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const reader = new FileReader()
    reader.onload = async () => {
      const url = reader.result as string
      setSourceUrl(url)
      const img = await loadImage(url)
      setNaturalW(img.naturalWidth)
      setNaturalH(img.naturalHeight)
      setWidth(img.naturalWidth)
      setHeight(img.naturalHeight)
    }
    reader.readAsDataURL(file)
  }

  function onWidthChange(value: number) {
    setWidth(value)
    if (lockAspect && naturalW > 0) {
      setHeight(Math.round((value / naturalW) * naturalH))
    }
  }

  function onHeightChange(value: number) {
    setHeight(value)
    if (lockAspect && naturalH > 0) {
      setWidth(Math.round((value / naturalH) * naturalW))
    }
  }

  const targetW = mode === 'percent' ? Math.max(1, Math.round((naturalW * percent) / 100)) : width
  const targetH = mode === 'percent' ? Math.max(1, Math.round((naturalH * percent) / 100)) : height

  useEffect(() => {
    if (!sourceUrl || !targetW || !targetH) return
    let cancelled = false
    const timeout = setTimeout(async () => {
      setProcessing(true)
      setError(null)
      try {
        const { blob } = await processImage({
          sourceUrl,
          outputFormat: 'image/jpeg',
          quality: 0.92,
          targetWidth: targetW,
          targetHeight: targetH,
        })
        if (cancelled) return
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return URL.createObjectURL(blob)
        })
        setPreviewKB(Math.round((blob.size / 1024) * 10) / 10)
      } catch {
        if (!cancelled) setError('Resize karne mein dikkat aayi, dobara try karo.')
      } finally {
        if (!cancelled) setProcessing(false)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [sourceUrl, targetW, targetH])

  function startOver() {
    setSourceUrl(null)
    setPreviewUrl(null)
    setPreviewKB(null)
    setNaturalW(0)
    setNaturalH(0)
    setPercent(50)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <Card>
      <div className="psr-card-inner">
        {!sourceUrl && (
          <div className="psr-field">
            <label>Image upload karo</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="psr-file-input" />
          </div>
        )}

        {sourceUrl && (
          <>
            <p className="psr-hint">Original: {naturalW}×{naturalH}px</p>

            <div className="flex justify-center gap-2 text-sm">
              <button type="button" className={`psr-secondary-button ${mode === 'percent' ? 'is-active' : ''}`} onClick={() => setMode('percent')}>By %</button>
              <button type="button" className={`psr-secondary-button ${mode === 'pixels' ? 'is-active' : ''}`} onClick={() => setMode('pixels')}>By pixels</button>
            </div>

            {mode === 'percent' ? (
              <div className="psr-field">
                <label>Scale: {percent}%</label>
                <input type="range" min={5} max={200} step={5} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className="w-full" />
                <p className="psr-hint">Naya size: {targetW}×{targetH}px</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="psr-field">
                  <label>Width (px)</label>
                  <input type="number" className="psr-select" value={width} onChange={(e) => onWidthChange(Number(e.target.value))} />
                </div>
                <div className="psr-field">
                  <label>Height (px)</label>
                  <input type="number" className="psr-select" value={height} onChange={(e) => onHeightChange(Number(e.target.value))} />
                </div>
                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={lockAspect} onChange={(e) => setLockAspect(e.target.checked)} />
                  Aspect ratio lock rakho
                </label>
              </div>
            )}

            <div className="psr-compare-grid">
              <div className="psr-compare-item">
                <span className="psr-compare-label">Original</span>
                <img src={sourceUrl} alt="Original" className="psr-compare-image" />
              </div>
              <div className="psr-compare-item">
                <span className="psr-compare-label">
                  Preview {previewKB !== null && `— ${previewKB}KB`} {processing && '…'}
                </span>
                {previewUrl && <img src={previewUrl} alt="Resized preview" className="psr-compare-image" />}
              </div>
            </div>

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            <div className="flex w-full gap-3">
              <Button variant="secondary" onClick={startOver} className="flex-1">Naya image</Button>
              {previewUrl && (
                <a href={previewUrl} download="resized-image.jpg" className="flex-[2]">
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
