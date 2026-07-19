import type { DocumentPage } from './types'
import { DEFAULT_SETTINGS, defaultQuad } from './imageProcessing'

export async function pdfToPages(file: File): Promise<DocumentPage[]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const bytes = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise
  const pages: DocumentPage[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i)
    const viewport = p.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas'); canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height)
    await p.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('PDF page render failed')), 'image/png'))
    const url = URL.createObjectURL(blob)
    pages.push({
      id: crypto.randomUUID(), name: `${file.name} · Page ${i}`, sourceUrl: url,
      width: canvas.width, height: canvas.height, rotation: 0,
      quad: defaultQuad(canvas.width, canvas.height), settings: { ...DEFAULT_SETTINGS },
      ocr: { text: '', progress: 0, status: 'idle' },
    })
  }
  await doc.destroy()
  return pages
}
