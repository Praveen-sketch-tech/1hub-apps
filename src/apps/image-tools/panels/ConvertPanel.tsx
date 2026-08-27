import { useState, useRef, useEffect } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { processImage } from '@apps/smart-image-tools/lib/imageProcessing'
import type { OutputFormat } from '@apps/smart-image-tools/types'

const FORMATS: { value: OutputFormat; label: string; ext: string }[] = [
  { value: 'image/jpeg', label: 'JPG', ext: 'jpg' },
  { value: 'image/png', label: 'PNG', ext: 'png' },
  { value: 'image/webp', label: 'WEBP', ext: 'webp' },
]

export function ConvertPanel() {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [sourceFormat, setSourceFormat] = useState<string>('')
  const [targetFormat, setTargetFormat] = useState<OutputFormat>('image/png')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewKB, setPreviewKB] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setSourceFormat(file.type)
    const reader = new FileReader()
    reader.onload = () => setSourceUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (!sourceUrl) return
    let cancelled = false
    setProcessing(true)
    setError(null)
    processImage({ sourceUrl, outputFormat: targetFormat, quality: 0.92 })
      .then(({ blob }) => {
        if (cancelled) return
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return URL.createObjectURL(blob)
        })
        setPreviewKB(Math.round((blob.size / 1024) * 10) / 10)
      })
      .catch(() => {
        if (!cancelled) setError('Convert karne mein dikkat aayi, dobara try karo.')
      })
      .finally(() => {
        if (!cancelled) setProcessing(false)
      })
    return () => {
      cancelled = true
    }
  }, [sourceUrl, targetFormat])

  function startOver() {
    setSourceUrl(null)
    setPreviewUrl(null)
    setPreviewKB(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const targetExt = FORMATS.find((f) => f.value === targetFormat)?.ext ?? 'jpg'

  return (
    <Card>
      <div className="psr-card-inner">
        {!sourceUrl && (
          <div className="psr-field">
            <label>Image upload karo (JPG, PNG, WEBP, ya koi bhi browser-supported format)</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="psr-file-input" />
          </div>
        )}

        {sourceUrl && (
          <>
            <p className="psr-hint">Current format: {sourceFormat.replace('image/', '').toUpperCase() || 'Unknown'}</p>

            <div className="psr-field">
              <label>Convert to</label>
              <select className="psr-select" value={targetFormat} onChange={(e) => setTargetFormat(e.target.value as OutputFormat)}>
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            <div className="psr-compare-grid">
              <div className="psr-compare-item">
                <span className="psr-compare-label">Original</span>
                <img src={sourceUrl} alt="Original" className="psr-compare-image" />
              </div>
              <div className="psr-compare-item">
                <span className="psr-compare-label">
                  {targetExt.toUpperCase()} preview {previewKB !== null && `— ${previewKB}KB`} {processing && '…'}
                </span>
                {previewUrl && <img src={previewUrl} alt="Converted preview" className="psr-compare-image" />}
              </div>
            </div>

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            <div className="flex w-full gap-3">
              <Button variant="secondary" onClick={startOver} className="flex-1">Naya image</Button>
              {previewUrl && (
                <a href={previewUrl} download={`converted.${targetExt}`} className="flex-[2]">
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
