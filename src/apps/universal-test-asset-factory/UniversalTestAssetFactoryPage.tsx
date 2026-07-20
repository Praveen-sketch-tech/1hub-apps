import { useEffect, useMemo, useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import type { AssetGenerationOptions, AssetType, GeneratedAsset } from './types'
import { generateTestAsset } from './lib/assetFactory'

const assetTypes: Array<{ value: AssetType; label: string; hint: string }> = [
  { value: 'png', label: 'PNG', hint: 'OCR, QR, barcode, transparency' },
  { value: 'jpg', label: 'JPG', hint: 'Photo/document-style image tests' },
  { value: 'webp', label: 'WebP', hint: 'Modern browser image tests' },
  { value: 'pdf', label: 'PDF', hint: 'Multi-page document tests' },
  { value: 'csv', label: 'CSV', hint: 'Structured data cleaning tests' },
  { value: 'xlsx', label: 'XLSX', hint: 'Sheets, formulas and dirty data' },
  { value: 'txt', label: 'TXT', hint: 'Text/OCR utility tests' },
  { value: 'json', label: 'JSON', hint: 'Nested structured test data' },
  { value: 'zip', label: 'ZIP', hint: 'Mixed reusable asset bundle' },
]

const imagePresets = [
  ['ocr-document', 'OCR document'],
  ['invoice', 'Invoice'],
  ['form', 'Form'],
  ['table', 'Data table'],
  ['qr', 'QR code'],
  ['barcode', 'Barcode'],
  ['test-pattern', 'Resolution test pattern'],
] as const

function downloadBlob(asset: GeneratedAsset): void {
  const url = URL.createObjectURL(asset.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = asset.fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function UniversalTestAssetFactoryPage() {
  const [assetType, setAssetType] = useState<AssetType>('png')
  const [preset, setPreset] = useState('ocr-document')
  const [width, setWidth] = useState(1200)
  const [height, setHeight] = useState(1600)
  const [pageCount, setPageCount] = useState(3)
  const [rowCount, setRowCount] = useState(30)
  const [sheetCount, setSheetCount] = useState(3)
  const [includeDuplicates, setIncludeDuplicates] = useState(true)
  const [includeMissingValues, setIncludeMissingValues] = useState(true)
  const [includeFormulas, setIncludeFormulas] = useState(true)
  const [includeQr, setIncludeQr] = useState(true)
  const [transparent, setTransparent] = useState(false)
  const [scanStyle, setScanStyle] = useState(true)
  const [noise, setNoise] = useState(6)
  const [blur, setBlur] = useState(0)
  const [skew, setSkew] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [fileName, setFileName] = useState('')
  const [qrText, setQrText] = useState('https://1hub-apps.vercel.app')
  const [barcodeText, setBarcodeText] = useState('017202600001')
  const [result, setResult] = useState<GeneratedAsset | null>(null)
  const [previewText, setPreviewText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isImage = assetType === 'jpg' || assetType === 'png' || assetType === 'webp'
  const isData = assetType === 'csv' || assetType === 'json' || assetType === 'xlsx'
  const previewUrl = useMemo(() => (result ? URL.createObjectURL(result.blob) : ''), [result])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function generate(): Promise<void> {
    setBusy(true)
    setError('')
    setPreviewText('')
    try {
      const options: AssetGenerationOptions = {
        assetType,
        preset,
        width,
        height,
        pageCount,
        rowCount,
        sheetCount,
        includeDuplicates,
        includeMissingValues,
        includeFormulas,
        includeQr,
        transparent,
        scanStyle,
        noise,
        blur,
        skew,
        rotation,
        fileName: fileName || undefined,
        qrText,
        barcodeText,
      }
      const generated = await generateTestAsset(options)
      setResult(generated)
      if (assetType === 'csv' || assetType === 'json' || assetType === 'txt') {
        setPreviewText((await generated.blob.text()).slice(0, 12000))
      }
    } catch (caught) {
      setResult(null)
      setError(caught instanceof Error ? caught.message : 'Unable to generate this asset.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tool-page utaf-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <ToolAppHeader
          appNumber="017"
          title="Universal Test Asset Factory"
          description="Generate rich reusable test files locally for OCR, documents, spreadsheets, QR/barcodes, cross-app workflows and automated demos."
        />
<div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="tool-panel">
            <h2 className="text-lg font-semibold">1. Choose asset type</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {assetTypes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setAssetType(item.value)}
                  className={`tool-card p-3 text-left transition ${assetType === item.value ? 'ring-2' : 'hover:opacity-80'}`}
                  style={assetType === item.value ? { borderColor: 'var(--tool-accent)', boxShadow: '0 0 0 2px var(--tool-accent)' } : undefined}
                >
                  <span className="block font-semibold">{item.label}</span>
                  <span className="tool-muted mt-1 block text-xs">{item.hint}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-1 block tool-label text-sm font-medium">File name (optional)</label>
                <input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="Auto-generated file name" className="w-full tool-input" />
              </div>

              {isImage && (
                <>
                  <div>
                    <label className="mb-1 block tool-label text-sm font-medium">Image scenario</label>
                    <select value={preset} onChange={(event) => setPreset(event.target.value)} className="tool-select w-full">
                      {imagePresets.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="tool-label text-sm">Width<input type="number" min={320} max={4096} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="tool-input mt-1" /></label>
                    <label className="tool-label text-sm">Height<input type="number" min={240} max={4096} value={height} onChange={(e) => setHeight(Number(e.target.value))} className="tool-input mt-1" /></label>
                  </div>
                  {preset === 'qr' && <label className="block tool-label text-sm">QR content<input value={qrText} onChange={(e) => setQrText(e.target.value)} className="tool-input mt-1" /></label>}
                  {preset === 'barcode' && <label className="block tool-label text-sm">Barcode content<input value={barcodeText} onChange={(e) => setBarcodeText(e.target.value)} className="tool-input mt-1" /></label>}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <label className="tool-muted text-xs">Noise {noise}<input type="range" min={0} max={40} value={noise} onChange={(e) => setNoise(Number(e.target.value))} className="w-full" /></label>
                    <label className="tool-muted text-xs">Blur {blur}<input type="range" min={0} max={6} value={blur} onChange={(e) => setBlur(Number(e.target.value))} className="w-full" /></label>
                    <label className="tool-muted text-xs">Skew {skew}°<input type="range" min={-8} max={8} value={skew} onChange={(e) => setSkew(Number(e.target.value))} className="w-full" /></label>
                    <label className="tool-muted text-xs">Rotate {rotation}°<input type="range" min={-10} max={10} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full" /></label>
                  </div>
                  <div className="flex flex-wrap gap-4 tool-label text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={scanStyle} onChange={(e) => setScanStyle(e.target.checked)} /> Scan style</label>
                    {(assetType === 'png' || assetType === 'webp') && <label className="flex items-center gap-2"><input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} /> Transparency</label>}
                  </div>
                </>
              )}

              {assetType === 'pdf' && (
                <>
                  <label className="block tool-label text-sm">PDF scenario<select value={preset} onChange={(e) => setPreset(e.target.value)} className="tool-select mt-1"><option value="scanned-document">Scanned multi-page document</option><option value="ocr-document">Clean OCR document</option><option value="invoice">Invoice document</option></select></label>
                  <label className="block tool-label text-sm">Pages<input type="number" min={1} max={20} value={pageCount} onChange={(e) => setPageCount(Number(e.target.value))} className="tool-input mt-1" /></label>
                  <div className="flex flex-wrap gap-4 tool-label text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={scanStyle} onChange={(e) => setScanStyle(e.target.checked)} /> Scan-style artifacts</label><label className="flex items-center gap-2"><input type="checkbox" checked={includeQr} onChange={(e) => setIncludeQr(e.target.checked)} /> Include QR</label></div>
                </>
              )}

              {isData && (
                <>
                  <label className="block tool-label text-sm">Rows<input type="number" min={5} max={5000} value={rowCount} onChange={(e) => setRowCount(Number(e.target.value))} className="tool-input mt-1" /></label>
                  {assetType === 'xlsx' && <label className="block tool-label text-sm">Sheets<input type="number" min={1} max={5} value={sheetCount} onChange={(e) => setSheetCount(Number(e.target.value))} className="tool-input mt-1" /></label>}
                  <div className="flex flex-wrap gap-4 tool-label text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={includeDuplicates} onChange={(e) => setIncludeDuplicates(e.target.checked)} /> Duplicate rows</label><label className="flex items-center gap-2"><input type="checkbox" checked={includeMissingValues} onChange={(e) => setIncludeMissingValues(e.target.checked)} /> Missing values</label>{assetType === 'xlsx' && <label className="flex items-center gap-2"><input type="checkbox" checked={includeFormulas} onChange={(e) => setIncludeFormulas(e.target.checked)} /> Formulas</label>}</div>
                </>
              )}

              {assetType === 'zip' && <p className="tool-card-muted tool-card p-3 text-sm">Creates a mixed bundle with OCR PNG, QR image, barcode image, scanned PDF, CSV, XLSX, JSON and TXT assets.</p>}

              <button type="button" disabled={busy} onClick={generate} className="tool-button tool-button-primary w-full py-3">{busy ? 'Generating locally…' : `Generate ${assetType.toUpperCase()} asset`}</button>
              {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" role="alert">{error}</p>}
            </div>
          </section>

          <section className="tool-panel">
            <h2 className="text-lg font-semibold">2. Preview & download</h2>
            {!result ? (
              <div className="tool-dropzone mt-4 flex min-h-80 items-center justify-center p-8 text-center text-sm">Configure a rich test scenario and generate the asset. Useful outputs are previewed here when practical.</div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="tool-card-muted tool-card p-3"><p className="font-medium">{result.fileName}</p><p className="tool-muted mt-1 text-sm">{result.summary}</p></div>
                {(result.assetType === 'jpg' || result.assetType === 'png' || result.assetType === 'webp') && <img src={previewUrl} alt="Generated test asset preview" className="tool-border max-h-[560px] w-full rounded-xl border object-contain" />}
                {result.assetType === 'pdf' && <iframe title="Generated PDF preview" src={previewUrl} className="tool-border h-[560px] w-full rounded-xl border" />}
                {previewText && <pre className="tool-card-muted tool-card max-h-[560px] overflow-auto whitespace-pre-wrap p-4 text-xs">{previewText}</pre>}
                {(result.assetType === 'xlsx' || result.assetType === 'zip') && <div className="tool-dropzone p-8 text-center text-sm">Binary asset generated successfully. Download it to test spreadsheet/file workflows.</div>}
                <button type="button" onClick={() => downloadBlob(result)} className="tool-button w-full py-3">Download {result.fileName}</button>
              </div>
            )}
          </section>
        </div>

        <section className="tool-panel">
          <h2 className="text-lg font-semibold">Reusable ecosystem capability</h2>
          <p className="tool-muted mt-2 text-sm leading-6">The same asset-generation layer powers this UI and Hub Assistant actions, and can be reused later by cross-app workflows, Smart Asset-to-Action Mapper and automated demo orchestrators without duplicating generation logic.</p>
        </section>
      </div>
    </div>
  )
}
