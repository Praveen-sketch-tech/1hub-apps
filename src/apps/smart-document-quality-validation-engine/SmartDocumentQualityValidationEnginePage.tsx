import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { downloadText } from '@shared/utils/downloads'
import { formatFileSize } from '@shared/utils/files'
import {
  createOcrSession,
  isSupportedDocument,
} from './lib/documentReader'
import { reportsToCsv, reportsToJson } from './lib/exporters'
import { validateDocumentFile } from './lib/qualityEngine'
import type {
  CustomPatternInput,
  DocumentQualityReport,
  OcrLanguage,
  ValidationDecision,
  ValidationPreset,
} from './lib/types'
import './smart-document-quality-validation-engine.css'

const ACCEPTED_FILES = '.pdf,.docx,.txt,.md,.csv,.json,.log,image/*'

type ItemStatus = 'queued' | 'processing' | 'done' | 'error'
type ResultFilter = 'all' | ValidationDecision

interface ValidationItem {
  id: string
  file: File
  status: ItemStatus
  progress: number
  statusText: string
  report?: DocumentQualityReport
  error?: string
  overrideDecision?: ValidationDecision
  reviewNote?: string
  previewUrl: string
}

function createItem(file: File): ValidationItem {
  return {
    id: crypto.randomUUID(),
    file,
    status: 'queued',
    progress: 0,
    statusText: 'Queued',
    previewUrl: URL.createObjectURL(file),
  }
}

function parsePatterns(value: string): CustomPatternInput[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const separator = line.indexOf('::')
      if (separator < 0) return { label: `Custom field ${index + 1}`, pattern: line }
      return {
        label: line.slice(0, separator).trim() || `Custom field ${index + 1}`,
        pattern: line.slice(separator + 2).trim(),
      }
    })
    .filter((item) => item.pattern)
}

function effectiveDecision(item: ValidationItem): ValidationDecision | undefined {
  return item.overrideDecision ?? item.report?.decision
}

function effectiveReport(item: ValidationItem): DocumentQualityReport | undefined {
  if (!item.report) return undefined
  if (!item.overrideDecision && !item.reviewNote?.trim()) return item.report
  const note = item.reviewNote?.trim()
  return {
    ...item.report,
    decision: item.overrideDecision ?? item.report.decision,
    summary: `${item.report.summary}${item.overrideDecision ? ` Manual decision override: ${item.overrideDecision}.` : ''}${note ? ` Reviewer note: ${note}` : ''}`,
  }
}

function decisionLabel(decision: ValidationDecision) {
  if (decision === 'pass') return 'Pass'
  if (decision === 'review') return 'Review'
  return 'Fail'
}

export default function SmartDocumentQualityValidationEnginePage() {
  const [items, setItems] = useState<ValidationItem[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Add documents to run local quality and validation checks.')
  const [useOcr, setUseOcr] = useState(true)
  const [language, setLanguage] = useState<OcrLanguage>('eng')
  const [maxPdfPages, setMaxPdfPages] = useState(12)
  const [maxOcrPages, setMaxOcrPages] = useState(3)
  const [preset, setPreset] = useState<ValidationPreset>('general')
  const [threshold, setThreshold] = useState(80)
  const [detectDuplicates, setDetectDuplicates] = useState(true)
  const [customKeywordText, setCustomKeywordText] = useState('')
  const [customPatternText, setCustomPatternText] = useState('')
  const [includeTextInJson, setIncludeTextInJson] = useState(false)
  const [filter, setFilter] = useState<ResultFilter>('all')
  const [previewItem, setPreviewItem] = useState<ValidationItem | null>(null)

  useEffect(() => {
    return () => {
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    }
  }, [])

  const updateItem = (id: string, patch: Partial<ValidationItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const addFiles = (files: FileList | File[]) => {
    const selected = Array.from(files)
    const valid = selected.filter(isSupportedDocument)
    const rejected = selected.length - valid.length
    if (valid.length) setItems((current) => [...current, ...valid.map(createItem)])
    setStatus(valid.length
      ? `Added ${valid.length} document${valid.length === 1 ? '' : 's'}.${rejected ? ` Skipped ${rejected} unsupported file${rejected === 1 ? '' : 's'}.` : ''}`
      : 'No supported PDF, DOCX, text or image files were selected.')
  }

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files)
    event.target.value = ''
  }

  const customKeywords = useMemo(() => customKeywordText
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean), [customKeywordText])
  const customPatterns = useMemo(() => parsePatterns(customPatternText), [customPatternText])

  const validateIds = async (ids: string[]) => {
    if (!ids.length || busy) return
    setBusy(true)
    const ocrSession = useOcr ? createOcrSession(language, (progress, message) => {
      setStatus(`OCR ${progress}% · ${message}`)
    }) : undefined

    try {
      for (let index = 0; index < ids.length; index += 1) {
        const id = ids[index]
        const item = items.find((candidate) => candidate.id === id)
        if (!item) continue
        updateItem(id, { status: 'processing', progress: 2, statusText: 'Checking file integrity…', error: undefined })
        setStatus(`Validating ${index + 1}/${ids.length}: ${item.file.name}`)
        try {
          const report = await validateDocumentFile(item.file, {
            useOcr,
            language,
            maxPdfPages,
            maxOcrPages,
            preset,
            threshold,
            detectDuplicates,
            customKeywords,
            customPatterns,
            includeExtractedText: true,
            ocrSession,
            onProgress: (progress, message) => updateItem(id, {
              progress,
              statusText: message,
            }),
          })
          updateItem(id, {
            status: 'done',
            progress: 100,
            statusText: report.summary,
            report,
            overrideDecision: undefined,
            reviewNote: '',
          })
        } catch (error) {
          updateItem(id, {
            status: 'error',
            progress: 0,
            statusText: 'Validation failed',
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
      setStatus('Validation complete. Documents below show whether they passed the configured score and quality checks.')
    } finally {
      if (ocrSession) await ocrSession.dispose()
      setBusy(false)
    }
  }

  const queuedIds = items.filter((item) => item.status !== 'processing').map((item) => item.id)
  const completed = items.filter((item) => item.report)
  const effectiveReports = completed.map(effectiveReport).filter((report): report is DocumentQualityReport => Boolean(report))
  const decisionCounts = useMemo(() => ({
    pass: completed.filter((item) => effectiveDecision(item) === 'pass').length,
    review: completed.filter((item) => effectiveDecision(item) === 'review').length,
    fail: completed.filter((item) => effectiveDecision(item) === 'fail').length,
  }), [completed])
  const averageScore = completed.length
    ? Math.round(completed.reduce((sum, item) => sum + (item.report?.score ?? 0), 0) / completed.length)
    : 0
  const visibleItems = filter === 'all' ? items : items.filter((item) => effectiveDecision(item) === filter)

  const exportJson = () => {
    if (!effectiveReports.length) return
    downloadText(reportsToJson(effectiveReports, includeTextInJson), 'document-quality-validation-report.json', 'application/json;charset=utf-8')
  }

  const exportCsv = () => {
    if (!effectiveReports.length) return
    downloadText(reportsToCsv(effectiveReports), 'document-quality-validation-report.csv', 'text/csv;charset=utf-8')
  }

  return (
    <main className="tool-page sdqv-page">
      <ToolAppHeader
        appNumber="032"
        title="Smart Document Quality & Validation Engine"
        description="Inspect document readability, page quality, OCR text, required fields, duplicates and file integrity locally with transparent browser-based checks."
      />

      <section className="tool-panel sdqv-intro">
        <div>
          <h2>Real checks, reviewable results</h2>
          <p className="tool-muted">The engine measures rendered pixels and extracted text. It does not claim AI understanding or guarantee legal, banking, KYC or compliance acceptance.</p>
        </div>
        <div className="sdqv-trust">Pixel metrics · OCR/text rules · Browser-local</div>
      </section>

      <section className="tool-grid-2 sdqv-setup-grid">
        <label
          className="tool-dropzone"
          onDragOver={(event: DragEvent<HTMLLabelElement>) => event.preventDefault()}
          onDrop={(event: DragEvent<HTMLLabelElement>) => {
            event.preventDefault()
            addFiles(event.dataTransfer.files)
          }}
        >
          <input type="file" multiple accept={ACCEPTED_FILES} onChange={onFileInput} />
          <strong>Drop documents or tap to browse</strong>
          <span className="tool-dropzone-muted">PDF, DOCX, TXT, MD, CSV, JSON and common image formats</span>
        </label>

        <article className="tool-card tool-stack">
          <div>
            <h2>Validation settings</h2>
            <p className="tool-muted">Scanned files use OCR only when enabled. Tesseract language data may download and cache on first use.</p>
          </div>
          <label className="sdqv-check-row">
            <input type="checkbox" checked={useOcr} onChange={(event) => setUseOcr(event.target.checked)} disabled={busy} />
            <span><strong>Use OCR for images and low-text PDF pages</strong><small>Embedded text is always preferred when available.</small></span>
          </label>
          <label className="sdqv-check-row">
            <input type="checkbox" checked={detectDuplicates} onChange={(event) => setDetectDuplicates(event.target.checked)} disabled={busy} />
            <span><strong>Detect visually similar PDF pages</strong><small>Uses a compact browser-local perceptual hash.</small></span>
          </label>
          <div className="tool-grid-2">
            <label className="tool-field">
              <span className="tool-label">Validation preset</span>
              <select className="tool-select" value={preset} onChange={(event) => setPreset(event.target.value as ValidationPreset)} disabled={busy}>
                <option value="general">General quality only</option>
                <option value="invoice">Invoice fields</option>
                <option value="receipt">Receipt fields</option>
                <option value="bank-statement">Bank statement fields</option>
                <option value="identity-document">Identity document fields</option>
                <option value="custom">Custom requirements</option>
              </select>
            </label>
            <label className="tool-field">
              <span className="tool-label">Pass threshold · {threshold}</span>
              <input className="sdqv-range" type="range" min="60" max="95" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} disabled={busy} />
            </label>
            <label className="tool-field">
              <span className="tool-label">PDF pages to validate</span>
              <select className="tool-select" value={maxPdfPages} onChange={(event) => setMaxPdfPages(Number(event.target.value))} disabled={busy}>
                <option value={5}>First 5 pages</option>
                <option value={12}>First 12 pages</option>
                <option value={20}>First 20 pages</option>
                <option value={30}>First 30 pages</option>
              </select>
            </label>
            <label className="tool-field">
              <span className="tool-label">OCR page limit</span>
              <select className="tool-select" value={maxOcrPages} onChange={(event) => setMaxOcrPages(Number(event.target.value))} disabled={!useOcr || busy}>
                <option value={1}>1 scanned page</option>
                <option value={3}>3 scanned pages</option>
                <option value={5}>5 scanned pages</option>
              </select>
            </label>
            <label className="tool-field">
              <span className="tool-label">OCR language</span>
              <select className="tool-select" value={language} onChange={(event) => setLanguage(event.target.value as OcrLanguage)} disabled={!useOcr || busy}>
                <option value="eng">English</option>
                <option value="hin">Hindi</option>
                <option value="eng+hin">English + Hindi</option>
              </select>
            </label>
          </div>
          <div className="tool-actions">
            <button className="tool-button tool-button-primary" disabled={!queuedIds.length || busy} onClick={() => void validateIds(queuedIds)}>
              {busy ? 'Validating…' : `Validate ${items.length || ''} document${items.length === 1 ? '' : 's'}`}
            </button>
            <button
              className="tool-button"
              disabled={!items.length || busy}
              onClick={() => {
                items.forEach((item) => URL.revokeObjectURL(item.previewUrl))
                setItems([])
                setPreviewItem(null)
                setStatus('Workspace cleared.')
              }}
            >
              Clear all
            </button>
          </div>
        </article>
      </section>

      <section className="tool-card tool-stack">
        <div>
          <h2>Custom required content</h2>
          <p className="tool-muted">These checks can be combined with any preset. Custom patterns use JavaScript regular-expression syntax and run locally.</p>
        </div>
        <div className="tool-grid-2">
          <label className="tool-field">
            <span className="tool-label">Required keywords</span>
            <textarea className="tool-textarea" value={customKeywordText} onChange={(event) => setCustomKeywordText(event.target.value)} placeholder="signature, approved, customer name" />
          </label>
          <label className="tool-field">
            <span className="tool-label">Required patterns · one per line</span>
            <textarea className="tool-textarea" value={customPatternText} onChange={(event) => setCustomPatternText(event.target.value)} placeholder={'Loan ID::LOAN-[0-9]{6}\nMobile::(?:\\+91[- ]?)?[6-9][0-9]{9}'} />
          </label>
        </div>
        <div className="sdqv-rule-counts">
          <span>{customKeywords.length} keyword requirement{customKeywords.length === 1 ? '' : 's'}</span>
          <span>{customPatterns.length} pattern requirement{customPatterns.length === 1 ? '' : 's'}</span>
        </div>
      </section>

      <section className="sdqv-status" aria-live="polite">{status}</section>

      {items.length > 0 && (
        <>
          <section className="tool-grid-4 sdqv-metrics">
            <article className="tool-card"><span>Documents</span><strong>{items.length}</strong></article>
            <article className="tool-card"><span>Average score</span><strong>{averageScore || '—'}</strong></article>
            <article className="tool-card"><span>Pass / Review</span><strong>{decisionCounts.pass} / {decisionCounts.review}</strong></article>
            <article className="tool-card"><span>Failed</span><strong>{decisionCounts.fail}</strong></article>
          </section>

          <section className="tool-card sdqv-toolbar">
            <div className="sdqv-filter-tabs" role="group" aria-label="Filter validation results">
              {(['all', 'pass', 'review', 'fail'] as ResultFilter[]).map((value) => (
                <button key={value} className={`tool-button ${filter === value ? 'sdqv-active-filter' : ''}`} onClick={() => setFilter(value)}>
                  {value === 'all' ? 'All' : decisionLabel(value)}
                </button>
              ))}
            </div>
            <div className="tool-actions">
              <label className="sdqv-inline-check">
                <input type="checkbox" checked={includeTextInJson} onChange={(event) => setIncludeTextInJson(event.target.checked)} />
                Include extracted text in JSON
              </label>
              <button className="tool-button" disabled={!effectiveReports.length} onClick={exportCsv}>Export CSV</button>
              <button className="tool-button tool-button-primary" disabled={!effectiveReports.length} onClick={exportJson}>Export JSON</button>
            </div>
          </section>

          <section className="sdqv-results">
            {visibleItems.map((item) => {
              const report = item.report
              const decision = effectiveDecision(item)
              const errors = report?.findings.filter((finding) => finding.severity === 'error').length ?? 0
              const warnings = report?.findings.filter((finding) => finding.severity === 'warning').length ?? 0
              return (
                <article className="tool-card sdqv-result-card" key={item.id}>
                  <div className="sdqv-result-head">
                    <button
                      type="button"
                      className="sdqv-file-preview"
                      onClick={() => setPreviewItem(item)}
                      aria-label={`Preview ${item.file.name}`}
                    >
                      {item.file.type.startsWith('image/') ? (
                        <img src={item.previewUrl} alt="" />
                      ) : item.file.type === 'application/pdf' || item.file.name.toLowerCase().endsWith('.pdf') ? (
                        <iframe src={item.previewUrl} title={`Preview ${item.file.name}`} />
                      ) : (
                        <span>DOC</span>
                      )}
                    </button>
                    <div className="sdqv-file-title">
                      <h3>{item.file.name}</h3>
                      <p className="tool-muted">{formatFileSize(item.file.size)} · {item.file.type || 'Unknown type'}</p>
                    </div>
                    {report && decision && (
                      <div className={`sdqv-score sdqv-${decision}`}>
                        <strong>{report.score}</strong>
                        <span>{decisionLabel(decision)} · Grade {report.grade}</span>
                      </div>
                    )}
                    <button
                      className="sdqv-remove"
                      aria-label={`Remove ${item.file.name}`}
                      disabled={busy}
                      onClick={() => {
                        URL.revokeObjectURL(item.previewUrl)
                        setItems((current) => current.filter((candidate) => candidate.id !== item.id))
                        if (previewItem?.id === item.id) setPreviewItem(null)
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {item.status === 'processing' && (
                    <div className="sdqv-progress-wrap">
                      <div className="sdqv-progress"><span style={{ width: `${item.progress}%` }} /></div>
                      <p>{item.statusText}</p>
                    </div>
                  )}
                  {item.status === 'queued' && <p className="sdqv-queued">Ready for validation.</p>}
                  {item.error && <div className="sdqv-error">{item.error}</div>}

                  {report && (
                    <div className="tool-stack">
                      <p className="sdqv-summary">
  {decision === 'fail'
    ? `Document needs review: score ${report.score}/100 is below the configured threshold of ${threshold}. ${errors} error${errors === 1 ? '' : 's'} and ${warnings} warning${warnings === 1 ? '' : 's'} detected.`
    : report.summary}
</p>
                      <div className="sdqv-result-stats">
                        <span><strong>{report.pagesRead}</strong> pages checked</span>
                        <span><strong>{report.ocrPages}</strong> OCR pages</span>
                        <span><strong>{errors}</strong> errors</span>
                        <span><strong>{warnings}</strong> warnings</span>
                        <span><strong>{report.textMetrics.words}</strong> words</span>
                      </div>

                      <div className="sdqv-findings">
                        {report.findings.length === 0 ? <div className="sdqv-clean">No quality or validation issues detected by the configured rules.</div> : report.findings.map((finding) => (
                          <div className={`sdqv-finding sdqv-finding-${finding.severity}`} key={finding.id}>
                            <strong>{finding.title}</strong>
                            <span>{finding.message}{finding.pageNumber ? ` · Page ${finding.pageNumber}` : ''}</span>
                          </div>
                        ))}
                      </div>

                      {report.fieldResults.length > 0 && (
                        <details className="sdqv-details">
                          <summary>Required-field validation</summary>
                          <div className="sdqv-field-list">
                            {report.fieldResults.map((field) => (
                              <div key={field.id} className={field.found ? 'sdqv-field-ok' : 'sdqv-field-missing'}>
                                <span>{field.found ? '✓' : '!'}</span>
                                <div><strong>{field.label}</strong><small>{field.error ?? field.value ?? (field.required ? 'Required value not found' : 'Optional value not found')}</small></div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {report.pageMetrics.length > 0 && (
                        <details className="sdqv-details">
                          <summary>Per-page pixel metrics</summary>
                          <div className="sdqv-table-wrap">
                            <table className="sdqv-table">
                              <thead><tr><th>Page</th><th>Visual</th><th>Sharpness</th><th>Brightness</th><th>Contrast</th><th>Skew</th><th>Blank</th></tr></thead>
                              <tbody>{report.pageMetrics.map((page) => (
                                <tr key={page.pageNumber}>
                                  <td>{page.pageNumber}</td><td>{page.visualScore}</td><td>{page.sharpnessScore}</td><td>{page.brightness}</td><td>{page.contrast}</td><td>{page.skewAngle}°</td><td>{Math.round(page.blankRatio * 100)}%</td>
                                </tr>
                              ))}</tbody>
                            </table>
                          </div>
                        </details>
                      )}

                      {(report.warnings.length > 0 || report.capabilityNotes.length > 0) && (
                        <details className="sdqv-details">
                          <summary>Limits and processing notes</summary>
                          <ul>{[...report.warnings, ...report.capabilityNotes].map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul>
                        </details>
                      )}

                      <div className="sdqv-review-panel">
                        <label className="tool-field">
                          <span className="tool-label">Manual decision override</span>
                          <select className="tool-select" value={item.overrideDecision ?? ''} onChange={(event) => updateItem(item.id, { overrideDecision: event.target.value ? event.target.value as ValidationDecision : undefined })}>
                            <option value="">Use engine decision</option>
                            <option value="pass">Pass</option>
                            <option value="review">Review</option>
                            <option value="fail">Fail</option>
                          </select>
                        </label>
                        <label className="tool-field">
                          <span className="tool-label">Reviewer note</span>
                          <input className="tool-input" value={item.reviewNote ?? ''} onChange={(event) => updateItem(item.id, { reviewNote: event.target.value })} placeholder="Optional note included in exports" />
                        </label>
                        <button className="tool-button" disabled={busy} onClick={() => void validateIds([item.id])}>Run again</button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </section>
        </>
      )}

      {previewItem && (
        <div
          className="sdqv-preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${previewItem.file.name}`}
          onClick={() => setPreviewItem(null)}
        >
          <div className="sdqv-preview-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="sdqv-preview-head">
              <div>
                <strong>{previewItem.file.name}</strong>
                <span>{formatFileSize(previewItem.file.size)}</span>
              </div>
              <button
                type="button"
                className="tool-button"
                onClick={() => setPreviewItem(null)}
              >
                Close
              </button>
            </div>

            <div className="sdqv-preview-body">
              {previewItem.file.type.startsWith('image/') ? (
                <img src={previewItem.previewUrl} alt={`Preview of ${previewItem.file.name}`} />
              ) : previewItem.file.type === 'application/pdf' || previewItem.file.name.toLowerCase().endsWith('.pdf') ? (
                <iframe src={previewItem.previewUrl} title={`Preview of ${previewItem.file.name}`} />
              ) : (
                <div className="sdqv-no-preview">
                  Preview is not available for this file type.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
