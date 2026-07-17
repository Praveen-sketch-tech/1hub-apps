/**
 * PDF generation using pdf-lib.
 *
 * All "build the final output" logic lives here: turning the current
 * workspace PageItem order into an actual PDF (or several, zipped, for
 * split output). This module never touches the DOM/UI — it only deals with
 * bytes in and Blob out — so it stays easy to unit test.
 */

import { PDFDocument, PDFPage, degrees } from 'pdf-lib';
import JSZip from 'jszip';
import type { GeneratedFile, ImagePlacement, PageItem, SourceFileRef, SplitRange } from '../types';
import { computePlacedImageRect, resolvePageDimensions } from './imageToPdf';
import { rangeLabel } from './splitRanges';
import { sanitizeBaseName } from './download';

type SourceMap = Map<string, SourceFileRef>;

/**
 * Builds a single output PDF from an ordered list of PageItems, pulling
 * bytes from the given source map. Handles both pdf-derived pages (copied
 * from their original document) and image-derived pages (drawn fresh using
 * the page's imagePlacement settings).
 */
export async function buildPdfFromPages(pages: PageItem[], sources: SourceMap): Promise<Uint8Array> {
  const output = await PDFDocument.create();

  // Group consecutive pdf-derived pages by source so we can batch-copy
  // pages from the same source document efficiently.
  const pdfDocCache = new Map<string, PDFDocument>();

  for (const item of pages) {
    if (item.pageType === 'pdf') {
      const source = sources.get(item.sourceId);
      if (!source) continue;
      let srcDoc = pdfDocCache.get(item.sourceId);
      if (!srcDoc) {
        srcDoc = await PDFDocument.load(source.bytes.slice(0), { ignoreEncryption: false });
        pdfDocCache.set(item.sourceId, srcDoc);
      }
      const [copiedPage] = await output.copyPages(srcDoc, [item.originalPageIndex ?? 0]);
      applyRotation(copiedPage, item.rotation);
      output.addPage(copiedPage);
    } else {
      await addImagePage(output, item, sources);
    }
  }

  return output.save();
}

function applyRotation(page: PDFPage, rotation: number): void {
  if (rotation === 0) return;
  const current = page.getRotation().angle;
  page.setRotation(degrees((current + rotation) % 360));
}

async function addImagePage(output: PDFDocument, item: PageItem, sources: SourceMap): Promise<void> {
  const source = sources.get(item.sourceId);
  if (!source) return;
  const placement: ImagePlacement = item.imagePlacement ?? {
    pageSize: 'a4',
    orientation: 'auto',
    margin: 'normal',
    fit: 'fit',
    offsetX: 0.5,
    offsetY: 0.5,
    scale: 1,
  };

  const bytes = source.bytes.slice(0);
  const isPng = /png/i.test(source.fileType) || /\.png$/i.test(source.fileName);
  // pdf-lib supports embedding JPG and PNG natively. WebP is not natively
  // supported by pdf-lib, so WebP images are re-encoded to PNG at upload
  // time (see PdfDropzone) before ever reaching this function.
  const embedded = isPng ? await output.embedPng(bytes) : await output.embedJpg(bytes);

  const { width: imgWidthPx, height: imgHeightPx } = embedded.scale(1);
  const pageDims = resolvePageDimensions(placement.pageSize, placement.orientation, imgWidthPx, imgHeightPx);
  const page = output.addPage([pageDims.width, pageDims.height]);
  if (item.rotation !== 0) applyRotation(page, item.rotation);

  const rect = computePlacedImageRect(placement, pageDims, imgWidthPx, imgHeightPx);
  // Flip Y: our rect uses a top-left origin; pdf-lib uses bottom-left.
  const pdfY = pageDims.height - rect.y - rect.height;

  page.drawImage(embedded, {
    x: rect.x,
    y: pdfY,
    width: rect.width,
    height: rect.height,
  });
}

/** Merge/Extract: build one PDF from the given page order. */
export async function generateMergedOrExtractedPdf(
  pages: PageItem[],
  sources: SourceMap,
  fileName: string
): Promise<GeneratedFile> {
  const bytes = await buildPdfFromPages(pages, sources);
  return {
    fileName,
    blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
    pageCount: pages.length,
  };
}

/** Images to PDF: identical mechanism to merge, kept as a distinct named entry point for clarity/analytics. */
export const generateImagesToPdf = generateMergedOrExtractedPdf;

/**
 * Split: builds one PDF per requested range, using the *current workspace
 * order* (post rotate/delete/reorder), then zips them if there's more than
 * one output file.
 */
export async function generateSplitOutputs(
  pages: PageItem[],
  sources: SourceMap,
  originalBaseName: string,
  ranges: SplitRange[]
): Promise<{ files: GeneratedFile[]; zipBlob?: Blob }> {
  const base = sanitizeBaseName(originalBaseName);
  const files: GeneratedFile[] = [];

  for (let i = 0; i < ranges.length; i += 1) {
    const range = ranges[i];
    const slice = pages.slice(range.start - 1, range.end);
    const bytes = await buildPdfFromPages(slice, sources);
    const fileName = `${base}-part-${i + 1}-${rangeLabel(range)}.pdf`;
    files.push({ fileName, blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), pageCount: slice.length });
  }

  if (files.length <= 1) {
    return { files };
  }

  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.fileName, file.blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return { files, zipBlob };
}
