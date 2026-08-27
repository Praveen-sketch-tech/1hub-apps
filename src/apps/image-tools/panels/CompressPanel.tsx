import { useState, useRef, useCallback, useEffect } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { processImage } from '@apps/smart-image-tools/lib/imageProcessing'

export function CompressPanel() {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [originalKB, setOriginalKB] = useState<number | null>(null)
  const [quality, setQuality] = useState(0.9) // 100% quality = best natural quality, no artificial throttle
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewKB, setPreviewKB] = useState<number | null>(null)
  const [encoding, setEncoding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runEncode = useCallback(async (url: string, q: number) => {
    setEncoding(true)
    setError(null)
    try {
      const { blob } = await processImage({ sourceUrl: url, outputFormat: 'image/jpeg', quality: q })
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(blob)
      })
      setPreviewKB(Math.round((blob.size / 1024) * 10) / 10)
    } catch {
      setError('Compress karne mein dikkat aayi, dobara try karo.')
    } finally {
      setEncoding(false)
    }
  }, [])

  useEffect(() => {
    if (!sourceUrl) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runEncode(sourceUrl, quality), 150)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl, quality])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setOriginalKB(Math.round((file.size / 1024) * 10) / 10)
    const reader = new FileReader()
    reader.onload = () => setSourceUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  function startOver() {
    setSourceUrl(null)
    setPreviewUrl(null)
    setPreviewKB(null)
    setOriginalKB(null)
    setQuality(0.9)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <Card>
      <div className="psr-card-inner">
        {!sourceUrl && (
          <div className="psr-field">
            <label>Koi bhi image upload karo</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="psr-file-input" />
          </div>
        )}

        {sourceUrl && (
          <>
            <div className="psr-compare-grid">
              <div className="psr-compare-item">
                <span className="psr-compare-label">Original — {originalKB}KB</span>
                <img src={sourceUrl} alt="Original" className="psr-compare-image" />
              </div>
              <div className="psr-compare-item">
                <span className="psr-compare-label">
                  Live preview {previewKB !== null && `— ${previewKB}KB`} {encoding && '…'}
                </span>
                {previewUrl && <img src={previewUrl} alt="Compressed preview" className="psr-compare-image" />}
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
              <p className="psr-hint">Kam quality = chhoti file. Slider drag karte hi preview aur size turant update hoti hai.</p>
            </div>

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            <div className="flex w-full gap-3">
              <Button variant="secondary" onClick={startOver} className="flex-1">Naya image</Button>
              {previewUrl && (
                <a href={previewUrl} download="compressed-image.jpg" className="flex-[2]">
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
