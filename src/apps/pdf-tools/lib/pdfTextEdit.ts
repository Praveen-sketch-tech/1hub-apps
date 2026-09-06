import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { loadPdfDocument } from '@apps/smart-pdf-tools/lib/pdfLoader'

export interface EditableTextItem {
  id: string
  str: string
  // Display-space (canvas pixel) bounding box, for the click-to-edit overlay UI.
  displayX: number
  displayY: number
  displayWidth: number
  displayHeight: number
  // Raw PDF-space values (pdf.js text transform is already in PDF user space,
  // same bottom-left-origin coordinate system pdf-lib expects) — used when
  // actually writing the edit back into the PDF.
  pdfX: number
  pdfY: number
  pdfWidth: number
  pdfFontSize: number
}

export interface PageRenderResult {
  canvasDataUrl: string
  displayWidth: number
  displayHeight: number
  items: EditableTextItem[]
}

/**
 * Renders one page to a canvas (for the click-to-edit UI) and extracts every
 * text run's position, both in display pixels (for the overlay) and in raw
 * PDF space (for writing edits back later).
 */
export async function renderPageForEditing(
  doc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  displayWidthTarget = 760,
): Promise<PageRenderResult> {
  const page = await doc.getPage(pageIndex + 1)
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = displayWidthTarget / baseViewport.width
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable.')
  await page.render({ canvasContext: ctx, viewport }).promise

  const textContent = await page.getTextContent()
  const items: EditableTextItem[] = []

  textContent.items.forEach((raw, i) => {
    if (!('str' in raw) || !raw.str.trim()) return
    const transform = raw.transform as number[]
    // pdf.js's own text-layer builder uses this exact formula for font size
    // in canvas pixels — reused here for consistency with what's visually rendered.
    const fontSize = Math.hypot(transform[2], transform[3])
    const combined = pdfjsLib.Util.transform(viewport.transform, transform)
    const displayX = combined[4]
    const displayY = combined[5] - fontSize * scale // baseline -> top-left
    const displayWidth = raw.width * scale
    const displayHeight = fontSize * scale * 1.15

    items.push({
      id: `${pageIndex}-${i}`,
      str: raw.str,
      displayX,
      displayY,
      displayWidth,
      displayHeight,
      pdfX: transform[4],
      pdfY: transform[5],
      pdfWidth: raw.width,
      pdfFontSize: fontSize,
    })
  })

  const blobUrl = canvas.toDataURL('image/png')
  return { canvasDataUrl: blobUrl, displayWidth: canvas.width, displayHeight: canvas.height, items }
}

export async function loadPdfForEditing(bytes: ArrayBuffer, fileName: string) {
  return loadPdfDocument(bytes, fileName)
}

export interface TextEdit {
  pageIndex: number
  pdfX: number
  pdfY: number
  pdfWidth: number
  pdfFontSize: number
  newText: string
}

/**
 * Applies edits directly onto the ORIGINAL PDF's pages (loaded via pdf-lib,
 * not re-rendered as images) — everything the user didn't touch stays crisp
 * vector content. Each edit covers the old text with a white rectangle sized
 * to its original bounding box, then draws the new text at the same spot
 * using a standard font at approximately the original size.
 *
 * Honest limitation: the new text always uses Helvetica, not the PDF's
 * original font, and won't perfectly match color/style — this is a
 * cover-and-retype approach, not true in-place text reflow.
 */
export async function applyTextEdits(originalBytes: ArrayBuffer, edits: TextEdit[]): Promise<Blob> {
  const doc = await PDFDocument.load(originalBytes)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const white = rgb(1, 1, 1)
  const black = rgb(0.05, 0.05, 0.08)

  for (const edit of edits) {
    const page = doc.getPage(edit.pageIndex)
    const padding = edit.pdfFontSize * 0.15
    // Cover the old text.
    page.drawRectangle({
      x: edit.pdfX - padding,
      y: edit.pdfY - padding,
      width: Math.max(edit.pdfWidth, font.widthOfTextAtSize(edit.newText, edit.pdfFontSize)) + padding * 2,
      height: edit.pdfFontSize + padding * 2,
      color: white,
    })
    // Draw the new text.
    page.drawText(edit.newText, {
      x: edit.pdfX,
      y: edit.pdfY,
      size: edit.pdfFontSize,
      font,
      color: black,
    })
  }

  const bytes = await doc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}
