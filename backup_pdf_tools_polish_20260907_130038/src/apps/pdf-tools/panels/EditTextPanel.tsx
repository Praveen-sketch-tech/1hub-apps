import { useState, useRef, useCallback } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import {
  loadPdfForEditing,
  renderPageForEditing,
  applyTextEdits,
  type EditableTextItem,
  type TextEdit,
} from '../lib/pdfTextEdit'
import type * as pdfjsLib from 'pdfjs-dist'

export function EditTextPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null)
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const [items, setItems] = useState<EditableTextItem[]>([])
  const [editedByPage, setEditedByPage] = useState<Map<string, string>>(new Map())
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [draftText, setDraftText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadPage = useCallback(async (pdfDoc: pdfjsLib.PDFDocumentProxy, idx: number) => {
    setLoading(true)
    setError(null)
    try {
      const rendered = await renderPageForEditing(pdfDoc, idx)
      setCanvasUrl(rendered.canvasDataUrl)
      setDisplaySize({ width: rendered.displayWidth, height: rendered.displayHeight })
      setItems(rendered.items)
      setPageIndex(idx)
      setActiveItemId(null)
    } catch {
      setError('Page render nahi ho payi — is PDF ka format support nahi ho raha shayad.')
    } finally {
      setLoading(false)
    }
  }, [])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)
    setResultUrl(null)
    setEditedByPage(new Map())
    try {
      const bytes = await f.arrayBuffer()
      const { doc: pdfDoc, numPages: n } = await loadPdfForEditing(bytes, f.name)
      setFile(f)
      setDoc(pdfDoc)
      setNumPages(n)
      await loadPage(pdfDoc, 0)
    } catch {
      setError('PDF khul nahi payi — password-protected ho sakti hai (pehle Unlock tab use karo) ya corrupt ho sakti hai.')
    }
  }

  function handleItemClick(item: EditableTextItem) {
    setActiveItemId(item.id)
    setDraftText(editedByPage.get(item.id) ?? item.str)
  }

  function saveDraft() {
    if (!activeItemId) return
    setEditedByPage((prev) => {
      const next = new Map(prev)
      next.set(activeItemId, draftText)
      return next
    })
    setActiveItemId(null)
  }

  async function goToPage(idx: number) {
    if (!doc || idx < 0 || idx >= numPages) return
    await loadPage(doc, idx)
  }

  async function handleSave() {
    if (!file || !doc) return
    setSaving(true)
    setError(null)
    try {
      const edits: TextEdit[] = []
      // Re-render every page that has at least one edit, to gather accurate
      // pdf-space coordinates for each edited item (items are only cached
      // in memory for the currently viewed page).
      const editedIds = Array.from(editedByPage.keys())
      const pagesWithEdits = new Set(editedIds.map((id) => Number(id.split('-')[0])))

      for (const pIdx of pagesWithEdits) {
        const rendered = pIdx === pageIndex ? { items } : await renderPageForEditing(doc, pIdx)
        for (const item of rendered.items) {
          const newText = editedByPage.get(item.id)
          if (newText !== undefined && newText !== item.str) {
            edits.push({
              pageIndex: pIdx,
              pdfX: item.pdfX,
              pdfY: item.pdfY,
              pdfWidth: item.pdfWidth,
              pdfFontSize: item.pdfFontSize,
              newText,
            })
          }
        }
      }

      if (edits.length === 0) {
        setError('Koi text edit nahi hua.')
        return
      }

      const bytes = await file.arrayBuffer()
      const blob = await applyTextEdits(bytes, edits)
      setResultUrl(URL.createObjectURL(blob))
    } catch {
      setError('Save karte waqt dikkat aayi, dobara try karo.')
    } finally {
      setSaving(false)
    }
  }

  function startOver() {
    setFile(null)
    setDoc(null)
    setCanvasUrl(null)
    setItems([])
    setEditedByPage(new Map())
    setResultUrl(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <Card>
      <div className="flex flex-col gap-4">
        {!file && (
          <div>
            <label className="mb-1 block text-sm font-medium">Text-based PDF upload karo (scanned/image PDF is v1 mein support nahi karta)</label>
            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFile} className="w-full text-sm" />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {file && canvasUrl && (
          <>
            {numPages > 1 && (
              <div className="flex items-center justify-center gap-3 text-sm">
                <button type="button" className="pdft-secondary-button" onClick={() => goToPage(pageIndex - 1)} disabled={pageIndex === 0}>← Prev</button>
                <span>Page {pageIndex + 1} / {numPages}</span>
                <button type="button" className="pdft-secondary-button" onClick={() => goToPage(pageIndex + 1)} disabled={pageIndex === numPages - 1}>Next →</button>
              </div>
            )}

            <p className="pdft-hint">Jis text ko edit karna hai usPe click karo.</p>

            <div className="pdft-edit-stage" style={{ width: displaySize.width, height: displaySize.height }}>
              <img src={canvasUrl} alt={`Page ${pageIndex + 1}`} width={displaySize.width} height={displaySize.height} />
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`pdft-edit-hit ${editedByPage.has(item.id) ? 'pdft-edit-hit--edited' : ''}`}
                  style={{ left: item.displayX, top: item.displayY, width: item.displayWidth, height: item.displayHeight }}
                  onClick={() => handleItemClick(item)}
                  title={editedByPage.get(item.id) ?? item.str}
                />
              ))}

              {activeItemId && (() => {
                const active = items.find((i) => i.id === activeItemId)
                if (!active) return null
                return (
                  <div className="pdft-edit-popover" style={{ left: active.displayX, top: active.displayY + active.displayHeight + 4 }}>
                    <input
                      autoFocus
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveDraft()}
                    />
                    <button type="button" onClick={saveDraft}>OK</button>
                  </div>
                )
              })()}
            </div>

            {loading && <p className="pdft-hint">Page load ho raha hai…</p>}

            <p className="pdft-hint">
              {editedByPage.size} edit{editedByPage.size === 1 ? '' : 's'} kiye gaye. Note: naya text Helvetica font mein
              likha jayega (original font match nahi hoga), purane text ke upar white box daal ke.
            </p>

            <div className="flex w-full gap-3">
              <Button variant="secondary" onClick={startOver} className="flex-1">Naya file</Button>
              <Button onClick={handleSave} disabled={saving || editedByPage.size === 0} className="pdft-primary-button flex-[2]">
                {saving ? 'Save ho raha hai…' : 'PDF save karo'}
              </Button>
            </div>

            {resultUrl && (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <p className="text-sm font-medium">Edited PDF ready hai.</p>
                <a href={resultUrl} download={file.name.replace(/\.pdf$/i, '') + '-edited.pdf'}>
                  <Button>Download</Button>
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}
