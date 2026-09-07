import { useState, useCallback } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { createPdfDocument } from '../lib/createPdfDocument'
import type { Alignment, Paragraph } from '../lib/domToModel'

interface ParagraphState {
  id: string
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
  fontSize: number
  align: Alignment
}

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32]
const DEFAULT_FONT_SIZE = 16

function newParagraph(overrides: Partial<ParagraphState> = {}): ParagraphState {
  return {
    id: crypto.randomUUID(),
    text: '',
    bold: false,
    italic: false,
    underline: false,
    fontSize: DEFAULT_FONT_SIZE,
    align: 'left',
    ...overrides,
  }
}

function previewStyle(p: ParagraphState): React.CSSProperties {
  return {
    fontWeight: p.bold ? 700 : 400,
    fontStyle: p.italic ? 'italic' : 'normal',
    textDecoration: p.underline ? 'underline' : 'none',
    fontSize: `${p.fontSize}px`,
    textAlign: p.align,
  }
}

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

export function CreatePanel() {
  const [paragraphs, setParagraphs] = useState<ParagraphState[]>([newParagraph()])
  const [activeId, setActiveId] = useState<string>(paragraphs[0].id)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)

  const active = paragraphs.find((p) => p.id === activeId) ?? paragraphs[0]

  const updateActive = useCallback((patch: Partial<ParagraphState>) => {
    setParagraphs((prev) => prev.map((p) => (p.id === activeId ? { ...p, ...patch } : p)))
  }, [activeId])

  function updateText(id: string, text: string) {
    setParagraphs((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)))
  }

  function addParagraphAfter(id: string) {
    setParagraphs((prev) => {
      const idx = prev.findIndex((p) => p.id === id)
      const current = prev[idx]
      // Carry over formatting so continuing to type feels natural (like pressing Enter in a document).
      const fresh = newParagraph({ bold: current.bold, italic: current.italic, fontSize: current.fontSize, align: current.align })
      const next = [...prev]
      next.splice(idx + 1, 0, fresh)
      setActiveId(fresh.id)
      return next
    })
  }

  function removeParagraph(id: string) {
    setParagraphs((prev) => {
      if (prev.length <= 1) return prev
      const idx = prev.findIndex((p) => p.id === id)
      const next = prev.filter((p) => p.id !== id)
      setActiveId(next[Math.max(0, idx - 1)].id)
      return next
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, id: string) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addParagraphAfter(id)
    } else if (e.key === 'Backspace' && (e.target as HTMLTextAreaElement).value === '' && paragraphs.length > 1) {
      e.preventDefault()
      removeParagraph(id)
    }
  }

  async function handleGenerate() {
    const nonEmpty = paragraphs.filter((p) => p.text.trim())
    if (nonEmpty.length === 0) {
      setError('Kuch text likho pehle.')
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const model: Paragraph[] = paragraphs.map((p) => ({
        align: p.align,
        runs: [{ text: p.text, bold: p.bold, italic: p.italic, underline: p.underline, fontSize: p.fontSize }],
      }))
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
        {/* Toolbar — always applies to the currently focused line */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
          <button type="button" onClick={() => updateActive({ bold: !active.bold })} className={`pdft-secondary-button ${active.bold ? 'is-active' : ''}`} style={{ fontWeight: 800 }}>B</button>
          <button type="button" onClick={() => updateActive({ italic: !active.italic })} className={`pdft-secondary-button ${active.italic ? 'is-active' : ''}`} style={{ fontStyle: 'italic' }}>I</button>
          <button type="button" onClick={() => updateActive({ underline: !active.underline })} className={`pdft-secondary-button ${active.underline ? 'is-active' : ''}`} style={{ textDecoration: 'underline' }}>U</button>

          <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600" />

          {(['left', 'center', 'right', 'justify'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => updateActive({ align: a })}
              className={`pdft-secondary-button ${active.align === a ? 'is-active' : ''}`}
              title={a}
            >
              {a === 'left' ? '⯇' : a === 'center' ? '≡' : a === 'right' ? '⯈' : '☰'}
            </button>
          ))}

          <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600" />

          <select value={active.fontSize} onChange={(e) => updateActive({ fontSize: Number(e.target.value) })} className="pdft-select" style={{ maxWidth: 90 }}>
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>
        </div>

        <p className="pdft-hint">
          Har line apni formatting rakhti hai — jis line pe click karoge, toolbar usी line ke liye kaam karega.
          Enter se nayi line banti hai, khaali line pe Backspace se pichhli line se jud jati hai.
        </p>

        {/* Editable lines — each one is its own paragraph with its own formatting */}
        <div className="pdft-create-editor">
          {paragraphs.map((p) => (
            <textarea
              key={p.id}
              value={p.text}
              onChange={(e) => {
                updateText(p.id, e.target.value)
                autoGrow(e.target)
              }}
              ref={(el) => el && autoGrow(el)}
              onFocus={() => setActiveId(p.id)}
              onKeyDown={(e) => handleKeyDown(e, p.id)}
              rows={1}
              placeholder={p.id === paragraphs[0].id ? 'Yahan type karo — Hindi ya English, dono chalega…' : ''}
              className={`pdft-create-line ${p.id === activeId ? 'pdft-create-line--active' : ''}`}
              style={previewStyle(p)}
            />
          ))}
        </div>

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
