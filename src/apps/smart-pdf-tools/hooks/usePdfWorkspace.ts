/**
 * usePdfWorkspace — the central state hook for Smart PDF Tools.
 *
 * Owns:
 *  - the map of source files (original bytes, one entry per uploaded file)
 *  - the ordered array of PageItems derived from those sources
 *  - all page-management mutations (reorder/rotate/delete/select)
 *  - thumbnail rendering orchestration (queued, async, cancellable per-item)
 *  - undo of the last mutation
 *  - progress state for long-running operations
 *
 * UI components never mutate pages directly — they call the actions
 * returned here, which keep sources/pages/thumbnails/undo consistent.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  ActionKind,
  PageItem,
  ProgressState,
  SourceFileRef,
} from '../types';
import { createDefaultImagePlacement, LIMITS } from '../types';
import { loadPdfDocument, EncryptedPdfError, InvalidPdfError, EmptyPdfError } from '../lib/pdfLoader';
import { renderPageThumbnail } from '../lib/pdfLoader';
import { renderImageThumbnail, getImageDimensions, thumbnailQueue } from '../lib/pdfRenderer';
import { registerObjectUrl, revokeObjectUrl, revokeAllObjectUrls } from '../lib/objectUrlRegistry';
import { useUndo } from './useUndo';
import { trackSmartPdfEvent, SMART_PDF_EVENTS } from '../lib/analytics';

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export interface UploadWarning {
  fileName: string;
  message: string;
}

export function usePdfWorkspace() {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [progress, setProgress] = useState<ProgressState>({ active: false, label: '' });
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<UploadWarning[]>([]);
  const sourcesRef = useRef<Map<string, SourceFileRef>>(new Map());
  const pdfDocCacheRef = useRef<Map<string, import('pdfjs-dist').PDFDocumentProxy>>(new Map());
  const { canUndo, recordUndoPoint, consumeUndo, clearUndo } = useUndo();

  const clearErrors = useCallback(() => setErrors([]), []);
  const clearWarnings = useCallback(() => setWarnings([]), []);

  const pushError = useCallback((message: string) => {
    setErrors((prev) => [...prev, message]);
  }, []);

  // ---- Thumbnail rendering -------------------------------------------------
  // renderThumbnailFor takes the PageItem itself (not just an id) so it never
  // depends on potentially-stale `pages` state from a prior render — this
  // matters because it's invoked immediately after setPages in addFiles(),
  // before React has committed that update.

  const renderThumbnailUrl = useCallback(async (item: PageItem): Promise<string> => {
    const source = sourcesRef.current.get(item.sourceId);
    if (!source) throw new Error('Source file missing.');

    if (item.pageType === 'pdf') {
      let doc = pdfDocCacheRef.current.get(item.sourceId);
      if (!doc) {
        const loaded = await loadPdfDocument(source.bytes, source.fileName);
        doc = loaded.doc;
        pdfDocCacheRef.current.set(item.sourceId, doc);
      }
      return renderPageThumbnail(doc, item.originalPageIndex ?? 0);
    }
    return renderImageThumbnail(source.bytes, mimeTypeFromFileName(source.fileName));
  }, []);

  const renderThumbnailFor = useCallback(
    async (item: PageItem) => {
      setPages((prev) => prev.map((p) => (p.id === item.id ? { ...p, thumbnailStatus: 'rendering' } : p)));

      try {
        const url = await thumbnailQueue.run(() => renderThumbnailUrl(item));
        setPages((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, thumbnailUrl: registerObjectUrl(url), thumbnailStatus: 'ready' } : p))
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not render this page.';
        setPages((prev) => prev.map((p) => (p.id === item.id ? { ...p, thumbnailStatus: 'error', thumbnailError: message } : p)));
      }
    },
    [renderThumbnailUrl]
  );

  // ---- File ingestion -------------------------------------------------------

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setProgress({ active: true, label: 'Reading files…', percent: 0 });
      clearErrors();

      const newPages: PageItem[] = [];
      const newWarnings: UploadWarning[] = [];

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        setProgress({ active: true, label: `Reading ${file.name}…`, percent: Math.round((i / files.length) * 100) });

        if (file.size > LIMITS.MAX_FILE_SIZE_BYTES) {
          newWarnings.push({ fileName: file.name, message: 'This file is quite large and may be slow to process in the browser.' });
        }

        try {
          const bytes = await file.arrayBuffer();
          const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
          const isImage = SUPPORTED_IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);

          if (isPdf) {
            const sourceId = nextId('src');
            const { doc, numPages } = await loadPdfDocument(bytes, file.name);
            pdfDocCacheRef.current.set(sourceId, doc);
            sourcesRef.current.set(sourceId, {
              id: sourceId,
              fileName: file.name,
              fileType: 'pdf',
              fileSize: file.size,
              bytes,
            });
            for (let p = 0; p < numPages; p += 1) {
              newPages.push({
                id: nextId('page'),
                sourceId,
                sourceFileName: file.name,
                pageType: 'pdf',
                originalPageIndex: p,
                thumbnailStatus: 'pending',
                rotation: 0,
                selected: false,
                order: 0,
              });
            }
            trackSmartPdfEvent(SMART_PDF_EVENTS.PDF_UPLOADED, { fileName: file.name, pageCount: numPages });
          } else if (isImage) {
            let workingBytes = bytes;
            let workingType = file.type || mimeTypeFromFileName(file.name);
            // pdf-lib cannot embed WebP directly; normalize to PNG at upload
            // time so downstream generation code has one consistent path.
            if (/webp/i.test(workingType)) {
              const converted = await convertWebpToPng(bytes);
              workingBytes = converted;
              workingType = 'image/png';
            }
            const sourceId = nextId('src');
            sourcesRef.current.set(sourceId, {
              id: sourceId,
              fileName: file.name,
              fileType: 'image',
              fileSize: file.size,
              bytes: workingBytes,
            });
            await getImageDimensions(workingBytes, workingType); // validates the image decodes
            newPages.push({
              id: nextId('page'),
              sourceId,
              sourceFileName: file.name,
              pageType: 'image',
              thumbnailStatus: 'pending',
              rotation: 0,
              selected: false,
              order: 0,
              imagePlacement: createDefaultImagePlacement(),
            });
            trackSmartPdfEvent(SMART_PDF_EVENTS.IMAGE_UPLOADED_FOR_PDF, { fileName: file.name });
          } else {
            pushError(`"${file.name}" is not a supported PDF or image file.`);
          }
        } catch (err) {
          if (err instanceof EncryptedPdfError || err instanceof InvalidPdfError || err instanceof EmptyPdfError) {
            pushError(err.message);
          } else {
            pushError(`"${file.name}" could not be processed.`);
          }
        }
      }

      setWarnings((prev) => [...prev, ...newWarnings]);

      setPages((prev) => {
        const combined = [...prev, ...newPages].map((p, idx) => ({ ...p, order: idx }));
        if (combined.length > LIMITS.MAX_TOTAL_PAGES_WARNING) {
          setWarnings((w) => [
            ...w,
            { fileName: '', message: `The workspace now has ${combined.length} pages, which may render slowly on some devices.` },
          ]);
        }
        return combined;
      });

      setProgress({ active: false, label: '' });

      // Kick off thumbnail rendering for the newly added pages.
      newPages.forEach((p) => {
        void renderThumbnailFor(p);
      });
    },
    [clearErrors, pushError, renderThumbnailFor]
  );

  // ---- Page-management actions ----------------------------------------------

  const withUndo = useCallback(
    (kind: ActionKind, mutate: (current: PageItem[]) => PageItem[]) => {
      setPages((prev) => {
        recordUndoPoint(kind, prev);
        return mutate(prev).map((p, idx) => ({ ...p, order: idx }));
      });
    },
    [recordUndoPoint]
  );

  const reorderPages = useCallback(
    (fromIndex: number, toIndex: number) => {
      withUndo('reorder', (current) => {
        const next = [...current];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
      trackSmartPdfEvent(SMART_PDF_EVENTS.PDF_PAGES_REORDERED, {});
    },
    [withUndo]
  );

  const rotatePage = useCallback(
    (pageId: string) => {
      withUndo('rotate-one', (current) =>
        current.map((p) => (p.id === pageId ? { ...p, rotation: (((p.rotation + 90) % 360) as PageItem['rotation']) } : p))
      );
      trackSmartPdfEvent(SMART_PDF_EVENTS.PDF_PAGE_ROTATED, { scope: 'single' });
    },
    [withUndo]
  );

  const rotateSelected = useCallback(() => {
    withUndo('rotate-selected', (current) =>
      current.map((p) => (p.selected ? { ...p, rotation: (((p.rotation + 90) % 360) as PageItem['rotation']) } : p))
    );
    trackSmartPdfEvent(SMART_PDF_EVENTS.PDF_PAGE_ROTATED, { scope: 'selected' });
  }, [withUndo]);

  const deletePage = useCallback(
    (pageId: string) => {
      withUndo('delete-one', (current) => {
        const target = current.find((p) => p.id === pageId);
        if (target?.thumbnailUrl) revokeObjectUrl(target.thumbnailUrl);
        return current.filter((p) => p.id !== pageId);
      });
      trackSmartPdfEvent(SMART_PDF_EVENTS.PDF_PAGE_DELETED, { scope: 'single' });
    },
    [withUndo]
  );

  const deleteSelected = useCallback(() => {
    withUndo('delete-selected', (current) => {
      current.filter((p) => p.selected).forEach((p) => revokeObjectUrl(p.thumbnailUrl));
      return current.filter((p) => !p.selected);
    });
    trackSmartPdfEvent(SMART_PDF_EVENTS.PDF_PAGE_DELETED, { scope: 'selected' });
  }, [withUndo]);

  const toggleSelect = useCallback((pageId: string) => {
    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, selected: !p.selected } : p)));
  }, []);

  const selectAll = useCallback(() => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: true })));
  }, []);

  const clearSelection = useCallback(() => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: false })));
  }, []);

  const updateImagePlacement = useCallback((pageId: string, updater: (prev: PageItem['imagePlacement']) => PageItem['imagePlacement']) => {
    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, imagePlacement: updater(p.imagePlacement) } : p)));
  }, []);

  const undo = useCallback(() => {
    const entry = consumeUndo();
    if (!entry) return;
    setPages(entry.pages);
  }, [consumeUndo]);

  const reset = useCallback(() => {
    revokeAllObjectUrls();
    sourcesRef.current.clear();
    pdfDocCacheRef.current.clear();
    setPages([]);
    clearUndo();
    clearErrors();
    clearWarnings();
  }, [clearUndo, clearErrors, clearWarnings]);

  const selectedCount = useMemo(() => pages.filter((p) => p.selected).length, [pages]);

  return {
    pages,
    sources: sourcesRef.current,
    progress,
    setProgress,
    errors,
    warnings,
    clearErrors,
    clearWarnings,
    addFiles,
    reorderPages,
    rotatePage,
    rotateSelected,
    deletePage,
    deleteSelected,
    toggleSelect,
    selectAll,
    clearSelection,
    updateImagePlacement,
    undo,
    canUndo,
    reset,
    selectedCount,
  };
}

function mimeTypeFromFileName(fileName: string): string {
  if (/\.png$/i.test(fileName)) return 'image/png';
  if (/\.webp$/i.test(fileName)) return 'image/webp';
  return 'image/jpeg';
}

/** Converts a WebP image's bytes to PNG bytes via canvas (pdf-lib has no native WebP embed support). */
async function convertWebpToPng(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const blob = new Blob([bytes], { type: 'image/webp' });
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(bitmap, 0, 0);
    const outBlob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!outBlob) throw new Error('Failed to convert WebP image.');
    return outBlob.arrayBuffer();
  } finally {
    bitmap.close();
  }
}
