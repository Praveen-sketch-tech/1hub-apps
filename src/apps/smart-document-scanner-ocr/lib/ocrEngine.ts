import type { OcrLanguage } from './types'

let worker: import('tesseract.js').Worker | null = null
let workerLang = ''
let cancelRequested = false

export async function recognizeCanvas(canvas: HTMLCanvasElement, language: OcrLanguage, onProgress: (p:number, status:string)=>void): Promise<string> {
  cancelRequested = false
  const lang = language === 'eng+hin' ? 'eng+hin' : language
  if (!worker || workerLang !== lang) {
    if (worker) await worker.terminate()
    const Tesseract = await import('tesseract.js')
    worker = await Tesseract.createWorker(lang, 1, {
      logger: m => { if (m.status) onProgress(Math.round((m.progress || 0) * 100), m.status) },
    })
    workerLang = lang
  }
  if (cancelRequested) throw new Error('OCR cancelled')
  const result = await worker.recognize(canvas)
  if (cancelRequested) throw new Error('OCR cancelled')
  return result.data.text || ''
}

export function cancelOcr() { cancelRequested = true }
export async function disposeOcr() { if (worker) await worker.terminate(); worker = null; workerLang = '' }
