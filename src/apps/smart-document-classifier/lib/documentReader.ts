import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import type { DocumentExtraction, OcrLanguage } from './types'

const MAX_TEXT_CHARACTERS = 300_000
const DEFAULT_MAX_PDF_PAGES = 30
const DEFAULT_MAX_OCR_PAGES = 3
const OCR_TRIGGER_CHARACTERS = 80

export interface OcrSession {
  recognizeCanvas: (
    canvas: HTMLCanvasElement,
    label: string,
  ) => Promise<string>
  dispose: () => Promise<void>
}

export function createOcrSession(
  language: OcrLanguage,
  onProgress?: (progress: number, status: string) => void,
): OcrSession {
  let worker: import('tesseract.js').Worker | null = null

  const ensureWorker = async () => {
    if (worker) return worker
    const Tesseract = await import('tesseract.js')
    worker = await Tesseract.createWorker(language, 1, {
      logger: (message) => {
        if (!message.status) return
        onProgress?.(Math.round((message.progress || 0) * 100), message.status)
      },
    })
    return worker
  }

  return {
    recognizeCanvas: async (canvas, label) => {
      onProgress?.(0, `Starting OCR for ${label}`)
      const activeWorker = await ensureWorker()
      const result = await activeWorker.recognize(canvas)
      return result.data.text || ''
    },
    dispose: async () => {
      if (worker) await worker.terminate()
      worker = null
    },
  }
}

function extensionOf(fileName: string) {
  return fileName.toLowerCase().split('.').pop() ?? ''
}

function limitText(text: string) {
  return text.slice(0, MAX_TEXT_CHARACTERS)
}

function isPlainTextFile(file: File) {
  const extension = extensionOf(file.name)
  return file.type.startsWith('text/') || ['txt', 'md', 'csv', 'json', 'log'].includes(extension)
}

function isDocxFile(file: File) {
  return file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extensionOf(file.name) === 'docx'
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || extensionOf(file.name) === 'pdf'
}

function isImageFile(file: File) {
  return file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(extensionOf(file.name))
}

async function imageFileToCanvas(file: File, maxSide = 2400) {
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('The image could not be decoded.'))
      element.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not supported in this browser.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function extractDocxText(file: File) {
  const JSZip = (await import('jszip')).default
  const archive = await JSZip.loadAsync(await file.arrayBuffer())
  const documentXml = archive.file('word/document.xml')
  if (!documentXml) throw new Error('This DOCX file does not contain a readable document body.')
  const xml = await documentXml.async('text')
  const parsed = new DOMParser().parseFromString(xml, 'application/xml')
  if (parsed.querySelector('parsererror')) throw new Error('The DOCX document XML could not be parsed.')
  const paragraphs = Array.from(parsed.getElementsByTagNameNS('*', 'p'))
    .map((paragraph) => paragraph.textContent?.trim() ?? '')
    .filter(Boolean)
  return limitText(paragraphs.join('\n'))
}

async function renderPdfPage(page: PDFPageProxy, scale = 1.7) {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(viewport.width))
  canvas.height = Math.max(1, Math.round(viewport.height))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not supported in this browser.')
  await page.render({ canvasContext: context, viewport }).promise
  return canvas
}

async function extractPdf(
  file: File,
  options: {
    useOcr: boolean
    maxPdfPages: number
    maxOcrPages: number
    ocrSession?: OcrSession
    onProgress?: (progress: number, status: string) => void
  },
): Promise<DocumentExtraction> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pagesRead = Math.min(document.numPages, options.maxPdfPages)
  const warnings: string[] = []
  const pageTexts: string[] = []

  try {
    for (let pageNumber = 1; pageNumber <= pagesRead; pageNumber += 1) {
      options.onProgress?.(
        Math.round((pageNumber / Math.max(1, pagesRead)) * 45),
        `Reading PDF text · page ${pageNumber}/${pagesRead}`,
      )
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items
        .map(item => ('str' in item ? String(item.str) : ''))
        .filter(Boolean)
        .join(' ')
      if (text.trim()) pageTexts.push(text)
      if (pageTexts.join('\n').length >= MAX_TEXT_CHARACTERS) break
    }

    let combined = limitText(pageTexts.join('\n\n'))
    let ocrPages = 0

    if (combined.trim().length < OCR_TRIGGER_CHARACTERS && options.useOcr) {
      if (!options.ocrSession) throw new Error('OCR session was not provided.')
      const count = Math.min(document.numPages, options.maxOcrPages)
      const ocrText: string[] = []
      for (let pageNumber = 1; pageNumber <= count; pageNumber += 1) {
        options.onProgress?.(
          45 + Math.round((pageNumber / Math.max(1, count)) * 50),
          `OCR scanned PDF · page ${pageNumber}/${count}`,
        )
        const page = await document.getPage(pageNumber)
        const canvas = await renderPdfPage(page)
        ocrText.push(await options.ocrSession.recognizeCanvas(canvas, `PDF page ${pageNumber}`))
        ocrPages += 1
      }
      combined = limitText(ocrText.join('\n\n'))
      if (document.numPages > count) warnings.push(`OCR was limited to the first ${count} pages for browser performance.`)
    }

    if (document.numPages > pagesRead) warnings.push(`Embedded text reading was limited to the first ${pagesRead} pages.`)
    if (!combined.trim()) warnings.push('No readable text was found; classification will rely mainly on the filename.')

    return {
      text: combined,
      method: ocrPages > 0 ? 'pdf-ocr' : combined.trim() ? 'pdf-text' : 'filename-only',
      pagesRead,
      ocrPages,
      warnings,
    }
  } finally {
    await document.destroy()
  }
}

export async function extractDocumentText(
  file: File,
  options: {
    useOcr: boolean
    language: OcrLanguage
    maxPdfPages?: number
    maxOcrPages?: number
    ocrSession?: OcrSession
    onProgress?: (progress: number, status: string) => void
  },
): Promise<DocumentExtraction> {
  if (isPlainTextFile(file)) {
    const text = limitText(await file.text())
    return { text, method: text.trim() ? 'plain-text' : 'filename-only', pagesRead: 1, ocrPages: 0, warnings: text.trim() ? [] : ['The text file is empty.'] }
  }

  if (isDocxFile(file)) {
    options.onProgress?.(25, 'Reading DOCX document locally')
    const text = await extractDocxText(file)
    return { text, method: text.trim() ? 'docx-text' : 'filename-only', pagesRead: 1, ocrPages: 0, warnings: text.trim() ? [] : ['No readable DOCX text was found.'] }
  }

  if (isPdfFile(file)) {
    return extractPdf(file, {
      useOcr: options.useOcr,
      maxPdfPages: options.maxPdfPages ?? DEFAULT_MAX_PDF_PAGES,
      maxOcrPages: options.maxOcrPages ?? DEFAULT_MAX_OCR_PAGES,
      ocrSession: options.ocrSession,
      onProgress: options.onProgress,
    })
  }

  if (isImageFile(file)) {
    if (!options.useOcr) {
      return {
        text: '',
        method: 'filename-only',
        pagesRead: 1,
        ocrPages: 0,
        warnings: ['OCR is disabled, so this image was classified from its filename only.'],
      }
    }
    if (!options.ocrSession) throw new Error('OCR session was not provided.')
    options.onProgress?.(10, 'Preparing image for OCR')
    const canvas = await imageFileToCanvas(file)
    const text = limitText(await options.ocrSession.recognizeCanvas(canvas, file.name))
    return {
      text,
      method: text.trim() ? 'image-ocr' : 'filename-only',
      pagesRead: 1,
      ocrPages: 1,
      warnings: text.trim() ? [] : ['OCR did not find readable text; classification will rely mainly on the filename.'],
    }
  }

  return {
    text: '',
    method: 'filename-only',
    pagesRead: 1,
    ocrPages: 0,
    warnings: ['This file type has no built-in text reader; classification used its filename only.'],
  }
}

export function isSupportedDocument(file: File) {
  return isPlainTextFile(file) || isDocxFile(file) || isPdfFile(file) || isImageFile(file)
}
