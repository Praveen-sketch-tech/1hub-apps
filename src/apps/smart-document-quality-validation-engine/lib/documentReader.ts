import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import { analyzePageCanvas } from './visualQuality'
import type { ExtractionMethod, OcrLanguage, PageQualityMetrics } from './types'

const MAX_TEXT_CHARACTERS = 300_000
const OCR_TRIGGER_CHARACTERS = 55

export interface OcrSession {
  recognizeCanvas: (canvas: HTMLCanvasElement, label: string) => Promise<string>
  dispose: () => Promise<void>
}

export interface ReadDocumentResult {
  text: string
  method: ExtractionMethod
  pagesRead: number
  ocrPages: number
  truncated: boolean
  pageMetrics: PageQualityMetrics[]
  warnings: string[]
  capabilityNotes: string[]
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
        if (message.status) onProgress?.(Math.round((message.progress || 0) * 100), message.status)
      },
    })
    return worker
  }

  return {
    recognizeCanvas: async (canvas, label) => {
      onProgress?.(0, `Starting OCR · ${label}`)
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

async function imageFileToCanvas(file: File, maxSide = 2600) {
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('The image could not be decoded. It may be corrupt or unsupported.'))
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
  let archive: Awaited<ReturnType<typeof JSZip.loadAsync>>
  try {
    archive = await JSZip.loadAsync(await file.arrayBuffer())
  } catch {
    throw new Error('The DOCX archive is corrupt or could not be opened.')
  }
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

async function renderPdfPage(page: PDFPageProxy) {
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(1.7, 1700 / Math.max(base.width, base.height))
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(viewport.width))
  canvas.height = Math.max(1, Math.round(viewport.height))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not supported in this browser.')
  await page.render({ canvasContext: context, viewport }).promise
  return canvas
}

function textFromPdfItems(items: Array<{ str?: unknown; hasEOL?: unknown }>) {
  let text = ''
  for (const item of items) {
    if (typeof item.str !== 'string') continue
    text += item.str
    text += item.hasEOL ? '\n' : ' '
  }
  return text.trim()
}

async function readPdf(
  file: File,
  options: {
    useOcr: boolean
    maxPdfPages: number
    maxOcrPages: number
    ocrSession?: OcrSession
    onProgress?: (progress: number, status: string) => void
  },
): Promise<ReadDocumentResult> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  let document: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>
  try {
    document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/password/i.test(message)) throw new Error('This PDF is password-protected. Unlock it before validation.')
    throw new Error(`The PDF is corrupt or unreadable: ${message}`)
  }

  const pagesRead = Math.min(document.numPages, options.maxPdfPages)
  const pageMetrics: PageQualityMetrics[] = []
  const pageTexts: string[] = []
  const warnings: string[] = []
  let ocrPages = 0

  try {
    for (let pageNumber = 1; pageNumber <= pagesRead; pageNumber += 1) {
      options.onProgress?.(
        Math.round(((pageNumber - 1) / Math.max(1, pagesRead)) * 90),
        `Validating PDF page ${pageNumber}/${pagesRead}`,
      )
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      let pageText = textFromPdfItems(content.items as Array<{ str?: unknown; hasEOL?: unknown }>)
      const canvas = await renderPdfPage(page)
      let usedOcr = false

      if (pageText.replace(/\s/g, '').length < OCR_TRIGGER_CHARACTERS && options.useOcr && ocrPages < options.maxOcrPages) {
        if (!options.ocrSession) throw new Error('OCR session was not provided.')
        pageText = await options.ocrSession.recognizeCanvas(canvas, `PDF page ${pageNumber}`)
        ocrPages += 1
        usedOcr = true
      }

      pageTexts.push(pageText)
      pageMetrics.push(analyzePageCanvas(canvas, pageNumber, pageText.trim().length, usedOcr))
      if (pageTexts.join('\n').length >= MAX_TEXT_CHARACTERS) break
    }

    if (document.numPages > pagesRead) warnings.push(`Validation was limited to the first ${pagesRead} of ${document.numPages} PDF pages for browser performance.`)
    if (options.useOcr && ocrPages >= options.maxOcrPages) {
      const remainingScanned = pageMetrics.filter((page) => page.textCharacters < OCR_TRIGGER_CHARACTERS && !page.usedOcr).length
      if (remainingScanned > 0) warnings.push(`OCR was limited to ${options.maxOcrPages} page${options.maxOcrPages === 1 ? '' : 's'}; ${remainingScanned} additional low-text page${remainingScanned === 1 ? '' : 's'} received visual checks only.`)
    }

    const text = limitText(pageTexts.join('\n\n'))
    return {
      text,
      method: ocrPages > 0 ? 'pdf-ocr' : text.trim() ? 'pdf-text' : 'filename-only',
      pagesRead: pageMetrics.length,
      ocrPages,
      truncated: document.numPages > pageMetrics.length || text.length >= MAX_TEXT_CHARACTERS,
      pageMetrics,
      warnings,
      capabilityNotes: [
        'PDF visual checks use browser-rendered pages, not the original scanner sensor data.',
        'Skew is an estimate from visible line structure and should be manually reviewed on graphics-heavy pages.',
      ],
    }
  } finally {
    await document.destroy()
  }
}

export async function readDocumentForValidation(
  file: File,
  options: {
    useOcr: boolean
    language: OcrLanguage
    maxPdfPages: number
    maxOcrPages: number
    ocrSession?: OcrSession
    onProgress?: (progress: number, status: string) => void
  },
): Promise<ReadDocumentResult> {
  if (file.size === 0) throw new Error('The selected file is empty.')

  if (isPlainTextFile(file)) {
    const text = limitText(await file.text())
    return {
      text,
      method: text.trim() ? 'plain-text' : 'filename-only',
      pagesRead: 1,
      ocrPages: 0,
      truncated: text.length >= MAX_TEXT_CHARACTERS,
      pageMetrics: [],
      warnings: text.trim() ? [] : ['The text file is empty.'],
      capabilityNotes: ['Plain-text files receive text and required-field validation; visual page checks do not apply.'],
    }
  }

  if (isDocxFile(file)) {
    options.onProgress?.(20, 'Checking DOCX structure and text')
    const text = await extractDocxText(file)
    return {
      text,
      method: text.trim() ? 'docx-text' : 'filename-only',
      pagesRead: 1,
      ocrPages: 0,
      truncated: text.length >= MAX_TEXT_CHARACTERS,
      pageMetrics: [],
      warnings: text.trim() ? [] : ['No readable DOCX text was found.'],
      capabilityNotes: ['DOCX validation checks archive integrity and document text; browser-local pagination and visual layout checks are not available.'],
    }
  }

  if (isPdfFile(file)) {
    return readPdf(file, options)
  }

  if (isImageFile(file)) {
    options.onProgress?.(12, 'Decoding and inspecting image pixels')
    const canvas = await imageFileToCanvas(file)
    let text = ''
    let usedOcr = false
    if (options.useOcr) {
      if (!options.ocrSession) throw new Error('OCR session was not provided.')
      text = limitText(await options.ocrSession.recognizeCanvas(canvas, file.name))
      usedOcr = true
    }
    return {
      text,
      method: usedOcr && text.trim() ? 'image-ocr' : 'filename-only',
      pagesRead: 1,
      ocrPages: usedOcr ? 1 : 0,
      truncated: false,
      pageMetrics: [analyzePageCanvas(canvas, 1, text.trim().length, usedOcr)],
      warnings: !options.useOcr ? ['OCR is disabled; text readability and required-field checks are limited.'] : text.trim() ? [] : ['OCR did not find readable text.'],
      capabilityNotes: ['Image quality metrics are calculated from a browser-safe decoded copy of the uploaded image.'],
    }
  }

  throw new Error('Unsupported file type. Use PDF, DOCX, TXT, MD, CSV, JSON or a common image format.')
}

export function isSupportedDocument(file: File) {
  return isPlainTextFile(file) || isDocxFile(file) || isPdfFile(file) || isImageFile(file)
}
