import { type ChangeEvent, type DragEvent, useMemo, useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { formatFileSize } from '@shared/utils/files'
import { classifyDocument, BUILT_IN_CATEGORIES } from './lib/documentClassifier'
import { createOcrSession, extractDocumentText, isSupportedDocument } from './lib/documentReader'
import { exportClassificationCsv, exportClassificationJson } from './lib/exporters'
import type {
  ClassifiedDocumentItem,
  CustomClassificationRule,
  OcrLanguage,
} from './lib/types'
import './smart-document-classifier.css'

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt,.md,.csv,.json,.log,image/*'

function createItem(file: File): ClassifiedDocumentItem {
  return {
    id: crypto.randomUUID(),
    file,
    status: 'queued',
    progress: 0,
    statusText: 'Ready to classify',
  }
}

function finalCategory(item: ClassifiedDocumentItem) {
  return item.overrideCategory || item.classification?.category || 'Unclassified'
}

export default function SmartDocumentClassifierPage() {
  const [items, setItems] = useState<ClassifiedDocumentItem[]>([])
  const [useOcr, setUseOcr] = useState(true)
  const [language, setLanguage] = useState<OcrLanguage>('eng')
  const [maxOcrPages, setMaxOcrPages] = useState(3)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Add documents to begin. Files stay in your browser.')
  const [showOnlyReview, setShowOnlyReview] = useState(false)
  const [customCategory, setCustomCategory] = useState('')
  const [customKeywords, setCustomKeywords] = useState('')
  const [customRules, setCustomRules] = useState<CustomClassificationRule[]>([])

  const updateItem = (id: string, patch: Partial<ClassifiedDocumentItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const addFiles = (files: FileList | File[]) => {
    const valid = Array.from(files).filter(isSupportedDocument)
    const rejected = Array.from(files).length - valid.length
    if (valid.length) setItems((current) => [...current, ...valid.map(createItem)])
    setStatus(
      valid.length
        ? `Added ${valid.length} document${valid.length === 1 ? '' : 's'}.${rejected ? ` Skipped ${rejected} unsupported file${rejected === 1 ? '' : 's'}.` : ''}`
        : 'No supported PDF, DOCX, text or image files were selected.',
    )
  }

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files)
    event.target.value = ''
  }

  const classifyIds = async (ids: string[]) => {
    if (!ids.length || busy) return
    setBusy(true)
    const ocrSession = createOcrSession(language, (progress, message) => {
      setStatus(`OCR ${progress}% · ${message}`)
    })

    try {
      for (let index = 0; index < ids.length; index += 1) {
        const id = ids[index]
        const item = items.find((candidate) => candidate.id === id)
        if (!item) continue
        updateItem(id, { status: 'processing', progress: 2, statusText: 'Reading document locally…', error: undefined })
        setStatus(`Classifying ${index + 1}/${ids.length}: ${item.file.name}`)

        try {
          const extraction = await extractDocumentText(item.file, {
            useOcr,
            language,
            maxPdfPages: 30,
            maxOcrPages,
            ocrSession,
            onProgress: (progress, message) => updateItem(id, {
              progress,
              statusText: message,
            }),
          })
          const classification = classifyDocument({
            text: extraction.text,
            fileName: item.file.name,
            customRules,
          })
          updateItem(id, {
            status: 'done',
            progress: 100,
            statusText: classification.lowConfidence ? 'Classified · review recommended' : 'Classified',
            extraction,
            classification,
            overrideCategory: undefined,
          })
        } catch (error) {
          updateItem(id, {
            status: 'error',
            progress: 0,
            statusText: 'Classification failed',
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
      setStatus('Classification finished. Review low-confidence items before exporting.')
    } finally {
      await ocrSession.dispose()
      setBusy(false)
    }
  }

  const queuedIds = items.filter((item) => item.status !== 'processing').map((item) => item.id)
  const completed = items.filter((item) => item.classification)
  const reviewCount = completed.filter((item) => item.classification?.lowConfidence && !item.overrideCategory).length
  const categories = useMemo(() => {
    const set = new Set<string>(BUILT_IN_CATEGORIES)
    customRules.forEach((rule) => set.add(rule.category))
    items.forEach((item) => {
      if (item.classification?.category) set.add(item.classification.category)
      if (item.overrideCategory) set.add(item.overrideCategory)
    })
    return [...set]
  }, [customRules, items])

  const visibleItems = showOnlyReview
    ? items.filter((item) => item.classification?.lowConfidence && !item.overrideCategory)
    : items

  const categorySummary = useMemo(() => {
    const counts = new Map<string, number>()
    completed.forEach((item) => counts.set(finalCategory(item), (counts.get(finalCategory(item)) ?? 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [completed])

  const addCustomRule = () => {
    const category = customCategory.trim()
    const keywords = customKeywords.split(',').map((keyword) => keyword.trim()).filter(Boolean)
    if (!category || !keywords.length) {
      setStatus('Enter a custom category and at least one comma-separated keyword.')
      return
    }
    setCustomRules((current) => [...current, { id: crypto.randomUUID(), category, keywords }])
    setCustomCategory('')
    setCustomKeywords('')
    setStatus(`Added custom rule for ${category}. Reclassify documents to apply it.`)
  }

  return (
    <main className="tool-page sdc-page">
      <ToolAppHeader
        appNumber="031"
        title="Smart Document Classifier"
        description="Classify PDFs, DOCX files, text documents and scanned images locally with transparent keyword and pattern rules. No AI model or server upload."
      />

      <section className="tool-panel sdc-intro">
        <div>
          <h2>Deterministic document sorting</h2>
          <p className="tool-muted">The classifier extracts readable text, scores visible signals and shows why each category won. OCR language data may be downloaded and cached by Tesseract on first use.</p>
        </div>
        <div className="sdc-trust">Rule-based · Browser-local · Reviewable</div>
      </section>

      <section className="tool-grid-2 sdc-setup-grid">
        <label
          className="tool-dropzone"
          onDragOver={(event: DragEvent<HTMLLabelElement>) => event.preventDefault()}
          onDrop={(event: DragEvent<HTMLLabelElement>) => {
            event.preventDefault()
            addFiles(event.dataTransfer.files)
          }}
        >
          <input type="file" multiple accept={ACCEPTED_EXTENSIONS} onChange={onFileInput} />
          <strong>Drop documents or tap to browse</strong>
          <span className="tool-dropzone-muted">PDF, DOCX, TXT, MD, CSV, JSON and common image formats</span>
        </label>

        <article className="tool-card tool-stack">
          <div className="sdc-card-head">
            <div>
              <h2>Reading options</h2>
              <p className="tool-muted">Embedded PDF and DOCX text is read directly. OCR is used only for images or scanned PDFs.</p>
            </div>
          </div>
          <label className="sdc-check-row">
            <input type="checkbox" checked={useOcr} onChange={(event: ChangeEvent<HTMLInputElement>) => setUseOcr(event.target.checked)} />
            <span><strong>Use OCR when needed</strong><small>Disable for filename/text-only classification.</small></span>
          </label>
          <div className="tool-grid-2">
            <label className="tool-field">
              <span className="tool-label">OCR language</span>
              <select className="tool-select" value={language} onChange={(event: ChangeEvent<HTMLSelectElement>) => setLanguage(event.target.value as OcrLanguage)} disabled={!useOcr || busy}>
                <option value="eng">English</option>
                <option value="hin">Hindi</option>
                <option value="eng+hin">English + Hindi</option>
              </select>
            </label>
            <label className="tool-field">
              <span className="tool-label">Scanned PDF OCR pages</span>
              <select className="tool-select" value={maxOcrPages} onChange={(event: ChangeEvent<HTMLSelectElement>) => setMaxOcrPages(Number(event.target.value))} disabled={!useOcr || busy}>
                <option value={1}>First page</option>
                <option value={3}>First 3 pages</option>
                <option value={5}>First 5 pages</option>
              </select>
            </label>
          </div>
          <div className="tool-actions">
            <button className="tool-button tool-button-primary" disabled={!queuedIds.length || busy} onClick={() => void classifyIds(queuedIds)}>
              {busy ? 'Classifying…' : `Classify ${items.length || ''} document${items.length === 1 ? '' : 's'}`}
            </button>
            <button className="tool-button" disabled={!items.length || busy} onClick={() => { setItems([]); setStatus('Workspace cleared.') }}>Clear all</button>
          </div>
        </article>
      </section>

      <section className="tool-card tool-stack">
        <div className="sdc-card-head">
          <div>
            <h2>Custom keyword rule</h2>
            <p className="tool-muted">Add a local category for your own workflow. Custom matches receive strong but still reviewable scores.</p>
          </div>
          <span className="sdc-count">{customRules.length} custom</span>
        </div>
        <div className="sdc-custom-rule">
          <input className="tool-input" value={customCategory} onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomCategory(event.target.value)} placeholder="Category, e.g. Loan Document" />
          <input className="tool-input" value={customKeywords} onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomKeywords(event.target.value)} placeholder="Keywords separated by commas" />
          <button className="tool-button" onClick={addCustomRule}>Add rule</button>
        </div>
        {customRules.length > 0 && (
          <div className="sdc-rule-list">
            {customRules.map((rule) => (
              <span key={rule.id} className="sdc-rule-chip">
                <strong>{rule.category}</strong> · {rule.keywords.join(', ')}
                <button aria-label={`Remove ${rule.category} rule`} onClick={() => setCustomRules((current) => current.filter((item) => item.id !== rule.id))}>×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="sdc-status" aria-live="polite">{status}</section>

      {items.length > 0 && (
        <>
          <section className="tool-grid-4 sdc-metrics">
            <article className="tool-card"><span>Documents</span><strong>{items.length}</strong></article>
            <article className="tool-card"><span>Classified</span><strong>{completed.length}</strong></article>
            <article className="tool-card"><span>Needs review</span><strong>{reviewCount}</strong></article>
            <article className="tool-card"><span>Categories used</span><strong>{categorySummary.length}</strong></article>
          </section>

          <section className="tool-card sdc-results-section">
            <div className="sdc-card-head sdc-results-head">
              <div>
                <h2>Classification results</h2>
                <p className="tool-muted">Manual overrides are included in exports without hiding the original suggestion.</p>
              </div>
              <div className="tool-actions">
                <button className={`tool-button ${showOnlyReview ? 'tool-button-primary' : ''}`} onClick={() => setShowOnlyReview((value) => !value)}>
                  {showOnlyReview ? 'Show all' : `Review queue (${reviewCount})`}
                </button>
                <button className="tool-button" disabled={!completed.length} onClick={() => exportClassificationCsv(items)}>Export CSV</button>
                <button className="tool-button" disabled={!completed.length} onClick={() => exportClassificationJson(items)}>Export JSON</button>
              </div>
            </div>

            <div className="sdc-result-list">
              {visibleItems.map((item) => (
                <article key={item.id} className="sdc-result-card">
                  <div className="sdc-result-main">
                    <div className="sdc-file-line">
                      <div>
                        <strong>{item.file.name}</strong>
                        <span>{formatFileSize(item.file.size)} · {item.file.type || 'Unknown type'}</span>
                      </div>
                      <button className="sdc-remove" aria-label={`Remove ${item.file.name}`} disabled={item.status === 'processing'} onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}>×</button>
                    </div>

                    {item.status === 'queued' && <p className="tool-muted">Ready to classify.</p>}
                    {item.status === 'processing' && (
                      <div className="sdc-progress-wrap">
                        <div className="sdc-progress"><span style={{ width: `${Math.max(3, item.progress)}%` }} /></div>
                        <small>{item.statusText}</small>
                      </div>
                    )}
                    {item.error && <p className="sdc-error">{item.error}</p>}

                    {item.classification && (
                      <>
                        <div className="sdc-classification-line">
                          <span className={`sdc-category ${item.classification.lowConfidence && !item.overrideCategory ? 'needs-review' : ''}`}>{finalCategory(item)}</span>
                          <strong>{item.classification.confidence}% confidence</strong>
                          {item.classification.lowConfidence && !item.overrideCategory && <span className="sdc-review-badge">Review</span>}
                        </div>
                        <p>{item.classification.reasons[0]}</p>
                        <div className="sdc-signal-list">
                          {item.classification.matchedSignals.slice(0, 6).map((signal) => <span key={signal}>{signal}</span>)}
                          {!item.classification.matchedSignals.length && <span>No strong content signal</span>}
                        </div>
                      </>
                    )}
                  </div>

                  <aside className="sdc-result-side">
                    {item.classification ? (
                      <>
                        <label className="tool-field">
                          <span className="tool-label">Final category</span>
                          <select className="tool-select" value={item.overrideCategory || item.classification.category} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateItem(item.id, { overrideCategory: event.target.value === item.classification?.category ? undefined : event.target.value })}>
                            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                          </select>
                        </label>
                        <button className="tool-button" disabled={busy} onClick={() => void classifyIds([item.id])}>Reclassify</button>
                        <details>
                          <summary>Extraction and score details</summary>
                          <dl className="sdc-details">
                            <div><dt>Method</dt><dd>{item.extraction?.method}</dd></div>
                            <div><dt>Pages read</dt><dd>{item.extraction?.pagesRead}</dd></div>
                            <div><dt>OCR pages</dt><dd>{item.extraction?.ocrPages}</dd></div>
                            <div><dt>Text characters</dt><dd>{item.extraction?.text.length ?? 0}</dd></div>
                          </dl>
                          {item.extraction?.warnings.map((warning) => <p className="sdc-warning" key={warning}>{warning}</p>)}
                          <ol className="sdc-score-list">
                            {item.classification.scores.map((score) => <li key={score.category}><span>{score.category}</span><strong>{score.score}</strong></li>)}
                          </ol>
                        </details>
                      </>
                    ) : (
                      <button className="tool-button" disabled={busy} onClick={() => void classifyIds([item.id])}>Classify</button>
                    )}
                  </aside>
                </article>
              ))}
              {visibleItems.length === 0 && <div className="sdc-empty-review">No documents currently need review.</div>}
            </div>
          </section>

          {categorySummary.length > 0 && (
            <section className="tool-card">
              <div className="sdc-card-head"><h2>Category summary</h2></div>
              <div className="sdc-summary-list">
                {categorySummary.map(([category, count]) => <span key={category}><strong>{category}</strong><b>{count}</b></span>)}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
