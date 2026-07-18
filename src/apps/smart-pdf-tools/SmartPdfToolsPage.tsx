import { useCallback, useMemo, useState } from 'react';
import type { CompressionMode, ImagePlacement, PageItem, ResultSummary, ToolMode } from './types';
import { usePdfWorkspace } from './hooks/usePdfWorkspace';
import ToolStartCards from './components/ToolStartCards';
import PageWorkspace from './components/PageWorkspace';
import WorkspaceToolbar from './components/WorkspaceToolbar';
import SplitPanel from './components/SplitPanel';
import CompressionPanel from './components/CompressionPanel';
import ResultPanel from './components/ResultPanel';
import ProgressPanel from './components/ProgressPanel';
import ImagePageEditor from './components/ImagePageEditor';
import { generateMergedOrExtractedPdf, generateSplitOutputs } from './lib/pdfGenerator';
import { compressPdf } from './lib/pdfCompression';
import { parseSplitRanges } from './lib/splitRanges';
import { getImageDimensions } from './lib/pdfRenderer';
import { trackSmartPdfEvent, SMART_PDF_EVENTS } from './lib/analytics';
import './smart-pdf-tools.css';
import { connectSmartPdfToolsAnalytics } from './lib/analyticsBridge';

/**
 * Top-level page for App #002 — Smart PDF Tools.
 *
 * Composes the unified workspace: upload → page thumbnails → select/reorder/
 * rotate/delete → choose an output operation → generate → result → download.
 * All processing happens client-side; nothing here talks to a server.
 */
connectSmartPdfToolsAnalytics()

export default function SmartPdfToolsPage() {
  const workspace = usePdfWorkspace();
  const [toolMode, setToolMode] = useState<ToolMode>(null);
  const [result, setResult] = useState<ResultSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [editingImagePageId, setEditingImagePageId] = useState<string | null>(null);
  const [pendingDeleteSelected, setPendingDeleteSelected] = useState(false);
  const [imageDimsCache] = useState(() => new Map<string, { width: number; height: number }>());
  const [, forceRerenderTick] = useState(0);

  const [hasStarted, setHasStarted] = useState(false);

  const handleInitialFiles = useCallback(
    (files: File[], preselectMode: ToolMode) => {
      setToolMode(preselectMode ?? 'merge');
      setHasStarted(true);
      void workspace.addFiles(files);
    },
    [workspace]
  );

  const handleAddFiles = useCallback(
    (files: File[]) => {
      void workspace.addFiles(files);
    },
    [workspace]
  );

  const handleStartOver = useCallback(() => {
    workspace.reset();
    setToolMode(null);
    setResult(null);
    setHasStarted(false);
  }, [workspace]);

  const handleDeleteSelectedClick = useCallback(() => {
    if (workspace.selectedCount > 1) {
      setPendingDeleteSelected(true);
    } else {
      workspace.deleteSelected();
    }
  }, [workspace]);

  const confirmDeleteSelected = useCallback(() => {
    workspace.deleteSelected();
    setPendingDeleteSelected(false);
  }, [workspace]);

  // ---- Generation handlers ---------------------------------------------

  const buildOutputFileName = (suffix: string) => {
    const firstName = workspace.pages[0]?.sourceFileName ?? 'document';
    const base = firstName.replace(/\.(pdf|jpe?g|png|webp)$/i, '');
    return `${base}-${suffix}.pdf`;
  };

  const handleGenerateMergeOrImages = useCallback(async () => {
    if (workspace.pages.length === 0) return;
    setIsGenerating(true);
    try {
      const fileName = buildOutputFileName(toolMode === 'images-to-pdf' ? 'from-images' : 'merged');
      const file = await generateMergedOrExtractedPdf(workspace.pages, workspace.sources, fileName);
      setResult({ operation: toolMode, files: [file], totalOutputSize: file.blob.size, isZip: false });
      trackSmartPdfEvent(
        toolMode === 'images-to-pdf' ? SMART_PDF_EVENTS.IMAGES_TO_PDF_USED : SMART_PDF_EVENTS.PDF_MERGE_USED,
        { pageCount: workspace.pages.length }
      );
    } catch {
      workspace.setProgress({ active: false, label: '' });
      alert('Something went wrong generating the PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.pages, workspace.sources, toolMode]);

  const handleExtractSelected = useCallback(async () => {
    const selected = workspace.pages.filter((p) => p.selected);
    if (selected.length === 0) return;
    setIsGenerating(true);
    try {
      const fileName = buildOutputFileName('extracted');
      const file = await generateMergedOrExtractedPdf(selected, workspace.sources, fileName);
      setResult({ operation: 'extract', files: [file], totalOutputSize: file.blob.size, isZip: false });
      trackSmartPdfEvent(SMART_PDF_EVENTS.PDF_PAGES_EXTRACTED, { pageCount: selected.length });
    } catch {
      alert('Something went wrong extracting pages. Please try again.');
    } finally {
      setIsGenerating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.pages, workspace.sources]);

  const handleSplit = useCallback(
    async (rangeInput: string) => {
      const { ranges } = parseSplitRanges(rangeInput, workspace.pages.length);
      if (ranges.length === 0) return;
      setIsGenerating(true);
      try {
        const baseName = workspace.pages[0]?.sourceFileName ?? 'document';
        const { files, zipBlob } = await generateSplitOutputs(workspace.pages, workspace.sources, baseName, ranges);
        if (zipBlob) {
          const zipName = `${baseName.replace(/\.(pdf|jpe?g|png|webp)$/i, '')}-split.zip`;
          setResult({
            operation: 'split',
            files: [{ fileName: zipName, blob: zipBlob, pageCount: files.reduce((s, f) => s + f.pageCount, 0) }],
            totalOutputSize: zipBlob.size,
            isZip: true,
          });
        } else {
          setResult({ operation: 'split', files, totalOutputSize: files.reduce((s, f) => s + f.blob.size, 0), isZip: false });
        }
        trackSmartPdfEvent(SMART_PDF_EVENTS.PDF_SPLIT_USED, { rangeCount: ranges.length });
      } catch {
        alert('Something went wrong splitting the PDF. Please try again.');
      } finally {
        setIsGenerating(false);
      }
    },
    [workspace.pages, workspace.sources]
  );

  const handleCompress = useCallback(
    async (mode: CompressionMode) => {
      const pdfSource = Array.from(workspace.sources.values()).find((s) => s.fileType === 'pdf');
      if (!pdfSource) {
        alert('Compression currently works on one uploaded PDF at a time. Add a PDF to compress.');
        return;
      }
      setIsGenerating(true);
      setGenProgress(0);
      try {
        const compressed = await compressPdf(pdfSource.bytes, pdfSource.fileName, mode, setGenProgress);
        setResult({
          operation: 'compress',
          files: [{ fileName: compressed.fileName, blob: compressed.blob, pageCount: compressed.pageCount }],
          totalOriginalSize: compressed.originalSize,
          totalOutputSize: compressed.compressedSize,
          isZip: false,
        });
        trackSmartPdfEvent(SMART_PDF_EVENTS.PDF_COMPRESS_USED, { mode, originalSize: compressed.originalSize, compressedSize: compressed.compressedSize });
      } catch {
        alert('Something went wrong compressing the PDF. Please try again.');
      } finally {
        setIsGenerating(false);
      }
    },
    [workspace.sources]
  );

  const editingPage: PageItem | undefined = useMemo(
    () => workspace.pages.find((p) => p.id === editingImagePageId),
    [workspace.pages, editingImagePageId]
  );

  const openImageEditor = useCallback(
    async (pageId: string) => {
      const page = workspace.pages.find((p) => p.id === pageId);
      if (!page || page.pageType !== 'image') return;
      const source = workspace.sources.get(page.sourceId);
      if (!source) return;
      if (!imageDimsCache.has(page.sourceId)) {
        const dims = await getImageDimensions(source.bytes, 'image/png');
        imageDimsCache.set(page.sourceId, dims);
        forceRerenderTick((t) => t + 1);
      }
      setEditingImagePageId(pageId);
    },
    [workspace.pages, workspace.sources, imageDimsCache]
  );

  const handleImagePlacementChange = useCallback(
    (pageId: string, updater: (prev: ImagePlacement | undefined) => ImagePlacement | undefined) => {
      workspace.updateImagePlacement(pageId, updater);
    },
    [workspace]
  );

  if (!hasStarted) {
    return (
      <div className="tool-page spt-root">
        <ToolStartCards onFilesSelected={handleInitialFiles} />
        <ProgressPanel progress={workspace.progress} />
        {workspace.errors.length > 0 && (
          <div className="spt-toast-stack">
            {workspace.errors.map((err, i) => (
              <div key={i} className="spt-toast spt-toast--error" role="alert">
                {err}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="spt-root spt-root--workspace">
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
              {toolMode === 'compress' && (
                <CompressionPanel onCompress={handleCompress} isProcessing={isGenerating} progressPercent={genProgress} />
              )}
              {toolMode === 'extract' && (
                <div className="spt-generate-panel">
                  <h2 className="spt-toolbar__heading">Extract selected pages</h2>
                  <p className="spt-field-hint">
                    Select pages in the workspace, then use the &quot;Extract selected&quot; button above.
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
            <div key={i} className="spt-toast spt-toast--warning" role="status">
              {w.message}
            </div>
          ))}
          <button type="button" className="spt-btn spt-btn--text" onClick={workspace.clearWarnings}>
            Dismiss
          </button>
        </div>
      )}
      {workspace.errors.length > 0 && (
        <div className="spt-toast-stack">
          {workspace.errors.map((err, i) => (
            <div key={i} className="spt-toast spt-toast--error" role="alert">
              {err}
            </div>
          ))}
          <button type="button" className="spt-btn spt-btn--text" onClick={workspace.clearErrors}>
            Dismiss
          </button>
        </div>
      )}

      {pendingDeleteSelected && (
        <div className="spt-modal-overlay" role="alertdialog" aria-modal="true" aria-label="Confirm delete">
          <div className="spt-modal spt-modal--small">
            <div className="spt-modal__header">
              <h2>Delete {workspace.selectedCount} pages?</h2>
            </div>
            <p className="spt-field-hint">This cannot be redone after the next action, though a single undo is available.</p>
            <div className="spt-modal__footer">
              <button type="button" className="spt-btn spt-btn--ghost" onClick={() => setPendingDeleteSelected(false)}>
                Cancel
              </button>
              <button type="button" className="spt-btn spt-btn--primary spt-btn--danger" onClick={confirmDeleteSelected}>
                Delete
              </button>
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
  );
}
