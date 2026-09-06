import { useCallback, useMemo, useState } from 'react'
import type { ImagePlacement, PageItem, ResultSummary, ToolMode } from '@apps/smart-pdf-tools/types'
import { usePdfWorkspace } from '@apps/smart-pdf-tools/hooks/usePdfWorkspace'
import PageWorkspace from '@apps/smart-pdf-tools/components/PageWorkspace'
import WorkspaceToolbar from '@apps/smart-pdf-tools/components/WorkspaceToolbar'
import SplitPanel from '@apps/smart-pdf-tools/components/SplitPanel'
import ResultPanel from '@apps/smart-pdf-tools/components/ResultPanel'
import ProgressPanel from '@apps/smart-pdf-tools/components/ProgressPanel'
import ImagePageEditor from '@apps/smart-pdf-tools/components/ImagePageEditor'
import { generateMergedOrExtractedPdf, generateSplitOutputs } from '@apps/smart-pdf-tools/lib/pdfGenerator'
import { parseSplitRanges } from '@apps/smart-pdf-tools/lib/splitRanges'
import { getImageDimensions } from '@apps/smart-pdf-tools/lib/pdfRenderer'
import '@apps/smart-pdf-tools/smart-pdf-tools.css'
import { PdfEditorStartCards } from './PdfEditorStartCards'

/**
 * Reuses Smart PDF Tools' (personal App #001) tested workspace — page
 * thumbnails, reorder, rotate, delete, image placement editor — for Merge,
 * Images→PDF, Split and Extract. Compress is deliberately NOT offered here;
 * the "Compress" tab that ships inside WorkspaceToolbar is hidden via CSS
 * and its mode changes are ignored below, since that component has no prop
 * to exclude a mode and the personal app itself must not be edited.
 */
export function PdfEditorPanel() {
  const workspace = usePdfWorkspace()
  const [toolMode, setToolModeRaw] = useState<ToolMode>(null)
  const [result, setResult] = useState<ResultSummary | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingImagePageId, setEditingImagePageId] = useState<string | null>(null)
  const [pendingDeleteSelected, setPendingDeleteSelected] = useState(false)
  const [imageDimsCache] = useState(() => new Map<string, { width: number; height: number }>())
  const [, forceRerenderTick] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)

  const setToolMode = useCallback((mode: ToolMode) => {
    if (mode === 'compress') return // Compress intentionally excluded from this app.
    setToolModeRaw(mode)
  }, [])

  const handleInitialFiles = useCallback(
    (files: File[], preselectMode: ToolMode) => {
      setToolMode(preselectMode ?? 'merge')
      setHasStarted(true)
      void workspace.addFiles(files)
    },
    [workspace, setToolMode],
  )

  const handleAddFiles = useCallback((files: File[]) => { void workspace.addFiles(files) }, [workspace])

  const handleStartOver = useCallback(() => {
    workspace.reset()
    setToolModeRaw(null)
    setResult(null)
    setHasStarted(false)
  }, [workspace])

  const handleDeleteSelectedClick = useCallback(() => {
    if (workspace.selectedCount > 1) setPendingDeleteSelected(true)
    else workspace.deleteSelected()
  }, [workspace])

  const confirmDeleteSelected = useCallback(() => {
    workspace.deleteSelected()
    setPendingDeleteSelected(false)
  }, [workspace])

  const buildOutputFileName = (suffix: string) => {
    const firstName = workspace.pages[0]?.sourceFileName ?? 'document'
    const base = firstName.replace(/\.(pdf|jpe?g|png|webp)$/i, '')
    return `${base}-${suffix}.pdf`
  }

  const handleGenerateMergeOrImages = useCallback(async () => {
    if (workspace.pages.length === 0) return
    setIsGenerating(true)
    try {
      const fileName = buildOutputFileName(toolMode === 'images-to-pdf' ? 'from-images' : 'merged')
      const file = await generateMergedOrExtractedPdf(workspace.pages, workspace.sources, fileName)
      setResult({ operation: toolMode, files: [file], totalOutputSize: file.blob.size, isZip: false })
    } catch {
      workspace.setProgress({ active: false, label: '' })
      alert('Kuch galat ho gaya PDF banate waqt, dobara try karo.')
    } finally {
      setIsGenerating(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.pages, workspace.sources, toolMode])

  const handleExtractSelected = useCallback(async () => {
    const selected = workspace.pages.filter((p) => p.selected)
    if (selected.length === 0) return
    setIsGenerating(true)
    try {
      const fileName = buildOutputFileName('extracted')
      const file = await generateMergedOrExtractedPdf(selected, workspace.sources, fileName)
      setResult({ operation: 'extract', files: [file], totalOutputSize: file.blob.size, isZip: false })
    } catch {
      alert('Kuch galat ho gaya pages extract karte waqt, dobara try karo.')
    } finally {
      setIsGenerating(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.pages, workspace.sources])

  const handleSplit = useCallback(
    async (rangeInput: string) => {
      const { ranges } = parseSplitRanges(rangeInput, workspace.pages.length)
      if (ranges.length === 0) return
      setIsGenerating(true)
      try {
        const baseName = workspace.pages[0]?.sourceFileName ?? 'document'
        const { files, zipBlob } = await generateSplitOutputs(workspace.pages, workspace.sources, baseName, ranges)
        if (zipBlob) {
          const zipName = `${baseName.replace(/\.(pdf|jpe?g|png|webp)$/i, '')}-split.zip`
          setResult({
            operation: 'split',
            files: [{ fileName: zipName, blob: zipBlob, pageCount: files.reduce((s, f) => s + f.pageCount, 0) }],
            totalOutputSize: zipBlob.size,
            isZip: true,
          })
        } else {
          setResult({ operation: 'split', files, totalOutputSize: files.reduce((s, f) => s + f.blob.size, 0), isZip: false })
        }
      } catch {
        alert('Kuch galat ho gaya PDF split karte waqt, dobara try karo.')
      } finally {
        setIsGenerating(false)
      }
    },
    [workspace.pages, workspace.sources],
  )

  const editingPage: PageItem | undefined = useMemo(
    () => workspace.pages.find((p) => p.id === editingImagePageId),
    [workspace.pages, editingImagePageId],
  )

  const openImageEditor = useCallback(
    async (pageId: string) => {
      const page = workspace.pages.find((p) => p.id === pageId)
      if (!page || page.pageType !== 'image') return
      const source = workspace.sources.get(page.sourceId)
      if (!source) return
      if (!imageDimsCache.has(page.sourceId)) {
        const dims = await getImageDimensions(source.bytes, 'image/png')
        imageDimsCache.set(page.sourceId, dims)
        forceRerenderTick((t) => t + 1)
      }
      setEditingImagePageId(pageId)
    },
    [workspace.pages, workspace.sources, imageDimsCache],
  )

  const handleImagePlacementChange = useCallback(
    (pageId: string, updater: (prev: ImagePlacement | undefined) => ImagePlacement | undefined) => {
      workspace.updateImagePlacement(pageId, updater)
    },
    [workspace],
  )

  if (!hasStarted) {
    return (
      <div className="pdft-editor-wrap">
        <PdfEditorStartCards onFilesSelected={handleInitialFiles} />
        <ProgressPanel progress={workspace.progress} />
        {workspace.errors.length > 0 && (
          <div className="spt-toast-stack">
            {workspace.errors.map((err, i) => (
              <div key={i} className="spt-toast spt-toast--error" role="alert">{err}</div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="spt-root spt-root--workspace pdft-editor-wrap">
      <div className="spt-layout">
        <main className="spt-layout__main">
          <PageWorkspace
            pages={workspace.pages}
            onReorder={workspace.reorderPages}
            onToggleSelect={workspace.toggleSelect}
            onRotate={workspace.rotatePage}
            onDelete={workspace.deletePage}
            onOpenImageEditor={openImageEditor}
          />
        </main>

        <WorkspaceToolbar
          toolMode={toolMode}
          onChangeMode={setToolMode}
          pageCount={workspace.pages.length}
          selectedCount={workspace.selectedCount}
          onSelectAll={workspace.selectAll}
          onClearSelection={workspace.clearSelection}
          onRotateSelected={workspace.rotateSelected}
          onDeleteSelected={handleDeleteSelectedClick}
          onExtractSelected={handleExtractSelected}
          onUndo={workspace.undo}
          canUndo={workspace.canUndo}
          onAddFiles={handleAddFiles}
          onStartOver={handleStartOver}
        >
          {result ? (
            <ResultPanel result={result} onCreateAnother={() => setResult(null)} />
          ) : (
            <>
              {(toolMode === 'merge' || toolMode === 'images-to-pdf') && (
                <div className="spt-generate-panel">
                  <h2 className="spt-toolbar__heading">
                    {toolMode === 'images-to-pdf' ? 'Generate PDF from images' : 'Generate merged PDF'}
                  </h2>
                  <p className="spt-field-hint">Output follows the current page order shown on the left.</p>
                  <button
                    type="button"
                    className="spt-btn spt-btn--primary"
                    disabled={isGenerating || workspace.pages.length === 0}
                    onClick={handleGenerateMergeOrImages}
                  >
                    {isGenerating ? 'Generating…' : 'Generate PDF'}
                  </button>
                </div>
              )}
              {toolMode === 'split' && (
                <SplitPanel totalPages={workspace.pages.length} onSplit={handleSplit} isProcessing={isGenerating} />
              )}
              {toolMode === 'extract' && (
                <div className="spt-generate-panel">
                  <h2 className="spt-toolbar__heading">Extract selected pages</h2>
                  <p className="spt-field-hint">
                    Workspace mein pages select karo, phir upar &quot;Extract selected&quot; button use karo.
                  </p>
                </div>
              )}
            </>
          )}
        </WorkspaceToolbar>
      </div>

      <ProgressPanel progress={workspace.progress} />

      {workspace.warnings.length > 0 && (
        <div className="spt-toast-stack">
          {workspace.warnings.map((w, i) => (
            <div key={i} className="spt-toast spt-toast--warning" role="status">{w.message}</div>
          ))}
          <button type="button" className="spt-btn spt-btn--text" onClick={workspace.clearWarnings}>Dismiss</button>
        </div>
      )}
      {workspace.errors.length > 0 && (
        <div className="spt-toast-stack">
          {workspace.errors.map((err, i) => (
            <div key={i} className="spt-toast spt-toast--error" role="alert">{err}</div>
          ))}
          <button type="button" className="spt-btn spt-btn--text" onClick={workspace.clearErrors}>Dismiss</button>
        </div>
      )}

      {pendingDeleteSelected && (
        <div className="spt-modal-overlay" role="alertdialog" aria-modal="true" aria-label="Confirm delete">
          <div className="spt-modal spt-modal--small">
            <div className="spt-modal__header"><h2>Delete {workspace.selectedCount} pages?</h2></div>
            <p className="spt-field-hint">This cannot be redone after the next action, though a single undo is available.</p>
            <div className="spt-modal__footer">
              <button type="button" className="spt-btn spt-btn--ghost" onClick={() => setPendingDeleteSelected(false)}>Cancel</button>
              <button type="button" className="spt-btn spt-btn--primary spt-btn--danger" onClick={confirmDeleteSelected}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {editingPage && editingPage.pageType === 'image' && (
        <ImagePageEditor
          page={editingPage}
          imageUrl={editingPage.thumbnailUrl ?? ''}
          imageDimensions={imageDimsCache.get(editingPage.sourceId) ?? { width: 1000, height: 1400 }}
          onChange={(updater) => handleImagePlacementChange(editingPage.id, updater)}
          onClose={() => setEditingImagePageId(null)}
        />
      )}
    </div>
  )
}
