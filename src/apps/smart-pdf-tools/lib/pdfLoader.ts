/**
 * PDF loading utilities built on pdfjs-dist.
 *
 * Worker setup uses Vite's `?url` import so the worker file is bundled and
 * served locally by the app itself — no reliance on a hardcoded CDN URL,
 * which would break offline use or under a strict Content-Security-Policy.
 */

import * as pdfjsLib from 'pdfjs-dist';
// Vite-specific worker import: bundles the worker as an asset and gives us
// a same-origin URL to it at build time. This is the recommended approach
// for pdfjs-dist under Vite (avoids CDN dependency entirely).
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export class EncryptedPdfError extends Error {
  constructor(fileName: string) {
    super(`"${fileName}" is password-protected and cannot be opened in v1.`);
    this.name = 'EncryptedPdfError';
  }
}

export class InvalidPdfError extends Error {
  cause?: Error;
  constructor(fileName: string, cause?: unknown) {
    super(`"${fileName}" could not be read. The file may be corrupt or not a valid PDF.`);
    this.name = 'InvalidPdfError';
    if (cause) this.cause = cause as Error;
  }
}

export class EmptyPdfError extends Error {
  constructor(fileName: string) {
    super(`"${fileName}" has no pages.`);
    this.name = 'EmptyPdfError';
  }
}

export interface LoadedPdf {
  doc: pdfjsLib.PDFDocumentProxy;
  numPages: number;
}

/**
 * Loads a PDF for rendering/inspection with pdf.js.
 * Throws EncryptedPdfError / InvalidPdfError / EmptyPdfError with
 * user-friendly messages on failure.
 */
export async function loadPdfDocument(bytes: ArrayBuffer, fileName: string): Promise<LoadedPdf> {
  // pdf.js detaches/transfers the buffer in some paths; pass a copy so the
  // caller's original ArrayBuffer (kept as the source of truth) stays intact.
  const copy = bytes.slice(0);
  let doc: pdfjsLib.PDFDocumentProxy;
  try {
    doc = await pdfjsLib.getDocument({ data: copy }).promise;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/password/i.test(message)) {
      throw new EncryptedPdfError(fileName);
    }
    throw new InvalidPdfError(fileName, err);
  }

  if (doc.numPages === 0) {
    throw new EmptyPdfError(fileName);
  }

  return { doc, numPages: doc.numPages };
}

/**
 * Renders a single PDF page to a canvas and returns a PNG object URL
 * suitable for use as a thumbnail. Caller is responsible for revoking the
 * URL via the objectUrlRegistry when no longer needed.
 */
export async function renderPageThumbnail(
  doc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  maxDimension = 320
): Promise<string> {
  const page = await doc.getPage(pageIndex + 1); // pdf.js pages are 1-indexed
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = maxDimension / Math.max(baseViewport.width, baseViewport.height);
  const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  await page.render({ canvasContext: ctx, viewport }).promise;

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Failed to generate thumbnail image.');
  return URL.createObjectURL(blob);
}
