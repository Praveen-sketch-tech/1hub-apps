import { downloadBlob } from '@shared/utils/downloads'
import type { DocumentPage } from './types'
import { canvasToBlob, renderProcessedPage } from './imageProcessing'



export async function exportPageImage(page: DocumentPage, type: 'jpeg'|'png') {
  const canvas = await renderProcessedPage(page)
  const mime = type === 'png' ? 'image/png' : 'image/jpeg'
  const blob = await canvasToBlob(canvas, mime, 0.94)
  downloadBlob(blob, `scan-${page.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.${type === 'png' ? 'png' : 'jpg'}`)
}

export function exportText(pages: DocumentPage[]) {
  const text = pages.map((p,i) => `--- Page ${i+1}: ${p.name} ---\n${p.ocr.text.trim()}`).join('\n\n')
  downloadBlob(new Blob([text], {type:'text/plain;charset=utf-8'}), 'document-ocr.txt')
}

export async function exportPdf(pages: DocumentPage[], searchable = false) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create(); const font = searchable ? await pdf.embedFont(StandardFonts.Helvetica) : null
  for (const page of pages) {
    const canvas = await renderProcessedPage(page)
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9); const bytes = await blob.arrayBuffer(); const img = await pdf.embedJpg(bytes)
    const maxW = 595.28, maxH = 841.89; const scale = Math.min(maxW/img.width,maxH/img.height); const w=img.width*scale,h=img.height*scale
    const out = pdf.addPage([w,h]); out.drawImage(img,{x:0,y:0,width:w,height:h})
    if (searchable && font && page.ocr.text.trim()) {
      const lines = page.ocr.text.replace(/[^\x20-\x7E\n]/g,' ').split(/\n+/).filter(Boolean).slice(0,120)
      let y = h - 12
      for (const line of lines) { out.drawText(line.slice(0,150), {x:4,y,size:8,font,color:rgb(0,0,0),opacity:0}); y -= 9; if (y < 4) break }
    }
  }
  const saved = await pdf.save(); const copy = new Uint8Array(saved.length); copy.set(saved)
  downloadBlob(new Blob([copy.buffer],{type:'application/pdf'}), searchable ? 'searchable-scan.pdf' : 'scanned-document.pdf')
}

export { downloadBlob }
