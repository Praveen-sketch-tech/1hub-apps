import { useState, useRef } from 'react'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
// Reuse the tested compression engine from Smart PDF Tools (App #002) instead
// of re-implementing PDF compression — same logic that already renders each
// page to a canvas and re-encodes it as a size/quality-tuned JPEG.
import { compressPdf } from '@apps/smart-pdf-tools/lib/pdfCompression'
import type { CompressionMode } from '@apps/smart-pdf-tools/types'

interface TargetPreset {
  label: string
  maxKB: number
}

const TARGETS: TargetPreset[] = [
  { label: '100 KB (WhatsApp status/DP-friendly)', maxKB: 100 },
  { label: '200 KB (form uploads)', maxKB: 200 },
  { label: '500 KB (email attachments)', maxKB: 500 },
]

// Modes tried in order of increasing compression until the target is hit.
const MODE_ORDER: CompressionMode[] = ['light', 'balanced', 'strong']

/**
 * Reusable processing function — same one the UI calls, and available for a
 * future chat action to call too.
 * Tries progressively stronger compression until the file is at/under the
 * chosen KB target, or all modes are exhausted (in which case we return the
 * smallest result achieved and say so honestly — never a false claim).
 */
async function compressToTarget(
  bytes: ArrayBuffer,
  fileName: string,
  maxKB: number,
  onProgress?: (percent: number, modeLabel: string) => void,
) {
  let best: Awaited<ReturnType<typeof compressPdf>> | null = null

  for (let i = 0; i < MODE_ORDER.length; i++) {
    const mode = MODE_ORDER[i]
    const result = await compressPdf(bytes, fileName, mode, (p) => {
      const overall = Math.round(((i + p / 100) / MODE_ORDER.length) * 100)
      onProgress?.(overall, mode)
    })

    if (!best || result.compressedSize < best.compressedSize) {
      best = result
    }
    if (result.compressedSize / 1024 <= maxKB) {
      return { result: best, withinTarget: true }
    }
  }

  return { result: best!, withinTarget: false }
}

export function PdfCompressorPage() {
  const [file, setFile] = useState<File | null>(null)
  const [maxKB, setMaxKB] = useState<number>(200)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusLabel, setStatusLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultKB, setResultKB] = useState<number | null>(null)
  const [originalKB, setOriginalKB] = useState<number | null>(null)
  const [resultFileName, setResultFileName] = useState('compressed.pdf')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Sirf PDF file upload karo.')
      return
    }
    setFile(f)
    setError(null)
    setWarning(null)
    setResultUrl(null)
    setOriginalKB(Math.round((f.size / 1024) * 10) / 10)
  }

  async function handleCompress() {
    if (!file) return
    setProcessing(true)
    setError(null)
    setWarning(null)
    setProgress(0)
    try {
      const bytes = await file.arrayBuffer()
      const { result, withinTarget } = await compressToTarget(bytes, file.name, maxKB, (p, mode) => {
        setProgress(p)
        setStatusLabel(`Compressing (${mode} mode)…`)
      })

      const finalKB = Math.round((result.compressedSize / 1024) * 10) / 10
      setResultKB(finalKB)
      setResultUrl(URL.createObjectURL(result.blob))
      setResultFileName(result.fileName)

      if (!withinTarget) {
        setWarning(
          `${maxKB}KB tak nahi pahunch paya — is PDF ke liye best possible size ${finalKB}KB hai (maximum compression already try ho chuki hai). Kam pages/kam images wali PDF is target ko easily hit kar degi.`,
        )
      }
    } catch {
      setError('PDF process nahi ho payi — file corrupt hai, password-protected hai, ya bahut badi hai. Dobara try karo.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <PageContainer>
      <div className="tool-page">
        <ToolAppHeader
          appNumber="002"
          title="PDF Compressor"
          description="PDF 2MB ki hai? WhatsApp-friendly size mein compress karo — 100KB, 200KB ya 500KB — sab kuch is browser ke andar hota hai, koi upload kisi server pe nahi jaata."
        />

        <Card>
          <div className="flex flex-col gap-5">
            <div>
              <label className="mb-1 block text-sm font-medium">Target size</label>
              <div className="flex flex-wrap gap-2">
                {TARGETS.map((t) => (
                  <button
                    key={t.maxKB}
                    type="button"
                    onClick={() => setMaxKB(t.maxKB)}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      maxKB === t.maxKB
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">PDF upload karo</label>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFile} className="w-full text-sm" />
            </div>

            {file && originalKB !== null && (
              <div className="flex items-center gap-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {file.name} — {originalKB >= 1024 ? `${(originalKB / 1024).toFixed(2)} MB` : `${originalKB} KB`}
                </p>
                <Button onClick={handleCompress} disabled={processing}>
                  {processing ? `${statusLabel} ${progress}%` : 'Compress karo'}
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {warning && !error && (
              <p className="text-sm text-amber-600 dark:text-amber-400">{warning}</p>
            )}

            {resultUrl && resultKB !== null && (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <p className="text-sm font-medium">
                  Ready — {resultKB >= 1024 ? `${(resultKB / 1024).toFixed(2)} MB` : `${resultKB} KB`}
                  {originalKB !== null && (
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      ({Math.round((1 - resultKB / originalKB) * 100)}% chhoti hui)
                    </span>
                  )}
                </p>
                <a href={resultUrl} download={resultFileName}>
                  <Button>Download</Button>
                </a>
              </div>
            )}

            <p className="text-xs text-slate-500">
              Note: yeh tool har page ko image ki tarah re-render karke compress karta hai, isliye output PDF se text
              copy-paste nahi hoga (sirf scanned/photo-heavy PDFs jaisa dikhega). Text-selectable PDF chahiye ho to
              compression skip kar dena.
            </p>
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}
