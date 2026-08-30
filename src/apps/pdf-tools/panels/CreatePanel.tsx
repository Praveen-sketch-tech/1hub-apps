import { useRef, useState, useEffect, useCallback } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { domToModel } from '../lib/domToModel'
import { createPdfDocument } from '../lib/createPdfDocument'

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32]
const BASE_FONT_SIZE = 16

function applyFontSize(px: number) {
  document.execCommand('fontSize', false, '7')
  const editor = document.activeElement?.closest('[contenteditable]') ?? document
  editor.querySelectorAll('font[size="7"]').forEach((el) => {
    const span = document.createElement('span')
    span.style.fontSize = `${px}px`
    span.innerHTML = el.innerHTML
    el.replaceWith(span)
  })
}

export function CreatePanel() {
  const editorRef = useRef<HTMLDivElement>(null)
  const [align, setAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left')
  const [fontSize, setFontSize] = useState(BASE_FONT_SIZE)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)

  useEffect(() => {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'div')
    } catch {
      // Older browsers may not support this — editor still works, just with slightly less predictable Enter behavior.
    }
  }, [])

  const exec = useCallback((command: string) => {
    editorRef.current?.focus()
    document.execCommand(command)
  }, [])

  function setAlignment(value: typeof align) {
    setAlign(value)
    editorRef.current?.focus()
    document.execCommand(
      value === 'left' ? 'justifyLeft' : value === 'center' ? 'justifyCenter' : value === 'right' ? 'justifyRight' : 'justifyFull',
    )
  }

  function changeFontSize(px: number) {
    setFontSize(px)
    editorRef.current?.focus()
    applyFontSize(px)
  }

  async function handleGenerate() {
    if (!editorRef.current) return
    const text = editorRef.current.innerText.trim()
    if (!text) {
      setError('Kuch text likho pehle.')
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const model = domToModel(editorRef.current, BASE_FONT_SIZE)
      const blob = await createPdfDocument(model)
      setResultUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(blob)
      })
    } catch {
      setError('PDF banane mein dikkat aayi, dobara try karo.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
          <button type="button" onClick={() => exec('bold')} className="pdft-secondary-button" style={{ fontWeight: 800 }}>B</button>
          <button type="button" onClick={() => exec('italic')} className="pdft-secondary-button" style={{ fontStyle: 'italic' }}>I</button>
          <button type="button" onClick={() => exec('underline')} className="pdft-secondary-button" style={{ textDecoration: 'underline' }}>U</button>

          <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600" />

          {(['left', 'center', 'right', 'justify'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAlignment(a)}
              className={`pdft-secondary-button ${align === a ? 'is-active' : ''}`}
              title={a}
            >
              {a === 'left' ? '⯇' : a === 'center' ? '≡' : a === 'right' ? '⯈' : '☰'}
            </button>
          ))}

          <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600" />

          <select value={fontSize} onChange={(e) => changeFontSize(Number(e.target.value))} className="pdft-select" style={{ maxWidth: 90 }}>
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="pdft-editor-page"
          style={{ fontSize: BASE_FONT_SIZE }}
          data-placeholder="Yahan type karo — Hindi ya English, dono chalega. Yahi tumhara final PDF layout hoga."
        />

        <p className="pdft-hint">
          Hindi text ke liye italic style available nahi hai (Devanagari font ka italic variant nahi hai) —
          baaki sab (bold, underline, alignment, size) dono languages mein kaam karta hai.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={handleGenerate} disabled={generating} className="pdft-primary-button">
          {generating ? 'PDF ban raha hai…' : 'PDF generate karo'}
        </Button>

        {resultUrl && (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <p className="text-sm font-medium">PDF ready hai.</p>
            <a href={resultUrl} download="document.pdf">
              <Button>Download</Button>
            </a>
          </div>
        )}
      </div>
    </Card>
  )
}
