/**
 * Basic browser-side PDF compression.
 *
 * Strategy:
 *  - Every page is rendered to a canvas via pdf.js and re-encoded as a JPEG
 *    at a mode-specific resolution/quality, then rebuilt into a new PDF with
 *    pdf-lib. This reliably shrinks image-heavy / scanned PDFs.
 *  - For text/vector-heavy PDFs this approach still works (it rasterizes
 *    everything), but gains will be smaller and, in Light mode particularly,
 *    may not beat the original — this is explained to the user rather than
 *    hidden. The compressed output is only kept if it's smaller than the
 *    original in the case the user hasn't explicitly overridden that in the
 *    UI (see ResultPanel — it always shows the honest number either way).
 *
 * v1 intentionally does not attempt to distinguish text-only pages from
 * image pages to keep scope small; this is called out in the README as a
 * known limitation and a natural place to extend later.
 */

import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { CompressionMode, CompressionResult } from '../types';
import { loadPdfDocument } from './pdfLoader';

interface CompressionProfile {
  maxDimension: number;
  jpegQuality: number;
}

const PROFILES: Record<CompressionMode, CompressionProfile> = {
  // High resolution, quality ~0.9 — preserves readability, modest savings.
  light: { maxDimension: 2000, jpegQuality: 0.9 },
  // Moderate resolution, quality ~0.78 — balanced default.
  balanced: { maxDimension: 1400, jpegQuality: 0.78 },
  // Lower resolution, quality ~0.6 — maximum savings, visible quality loss.
  strong: { maxDimension: 1000, jpegQuality: 0.6 },
};

export async function compressPdf(
  bytes: ArrayBuffer,
  fileName: string,
  mode: CompressionMode,
  onProgress?: (percent: number) => void
): Promise<CompressionResult> {
  const profile = PROFILES[mode];
  const { doc, numPages } = await loadPdfDocument(bytes, fileName);

  const output = await PDFDocument.create();

  for (let i = 0; i < numPages; i += 1) {
    const jpegBytes = await renderPageToJpeg(doc, i, profile.maxDimension, profile.jpegQuality);
    const image = await output.embedJpg(jpegBytes);
    const page = output.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    onProgress?.(Math.round(((i + 1) / numPages) * 100));
  }

  const outBytes = await output.save();
  const compressedBlob = new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' });

  return {
    originalSize: bytes.byteLength,
    compressedSize: compressedBlob.size,
    pageCount: numPages,
    mode,
    blob: compressedBlob,
    fileName: fileName.replace(/\.pdf$/i, '') + `-compressed.pdf`,
  };
}

async function renderPageToJpeg(
  doc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  maxDimension: number,
  quality: number
): Promise<ArrayBuffer> {
  const page = await doc.getPage(pageIndex + 1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(maxDimension / Math.max(baseViewport.width, baseViewport.height), 3);
  const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  // White background so transparent PDF regions don't turn black in JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Failed to encode compressed page.');
  return blob.arrayBuffer();
}
