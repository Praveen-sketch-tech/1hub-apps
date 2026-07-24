import { PaddleOCR } from '@paddleocr/paddleocr-js'
import type { OcrLanguage, OcrLine } from './types'

type RealLanguage = 'hi' | 'en'
type PaddleInstance = Awaited<ReturnType<typeof PaddleOCR.create>>

const engines = new Map<RealLanguage, Promise<PaddleInstance>>()

function engineFor(language: RealLanguage) {
  let engine = engines.get(language)

  if (!engine) {
    engine = PaddleOCR.create({
      lang: language,
      ocrVersion: language === 'hi' ? 'PP-OCRv3' : 'PP-OCRv5',
      worker: true,
      ortOptions: {
        backend: 'wasm',
        wasmPaths: 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/',
        numThreads: 1,
        simd: true,
      },
    })

    engines.set(language, engine)
  }

  return engine
}

function top(line: OcrLine) {
  return Math.min(...line.poly.map(point => point[1]))
}

function left(line: OcrLine) {
  return Math.min(...line.poly.map(point => point[0]))
}

function height(line: OcrLine) {
  const values = line.poly.map(point => point[1])
  return Math.max(...values) - Math.min(...values)
}

function normalizeLines(input: OcrLine[]): OcrLine[] {
  const sorted = [...input].sort((a, b) => top(a) - top(b) || left(a) - left(b))
  const rows: OcrLine[][] = []

  for (const line of sorted) {
    const lineTop = top(line)
    const lineHeight = Math.max(8, height(line))

    const row = rows.find(existing => {
      const reference = existing[0]
      const tolerance = Math.max(lineHeight, height(reference)) * 0.65
      return Math.abs(top(reference) - lineTop) <= tolerance
    })

    if (row) row.push(line)
    else rows.push([line])
  }

  return rows
    .map(row => {
      const ordered = row.sort((a, b) => left(a) - left(b))
      const text = ordered.map(item => item.text.trim()).filter(Boolean).join(' ')
      const score = ordered.reduce((sum, item) => sum + item.score, 0) / ordered.length
      const poly = ordered.flatMap(item => item.poly)

      return { text, score, poly }
    })
    .filter(line => {
      const cleaned = line.text.replace(/[^A-Za-z0-9ऀ-ॿ]/g, '')
      return cleaned.length >= 2
    })
}

async function runSingle(
  input: Blob | HTMLCanvasElement,
  language: RealLanguage,
) {
  const engine = await engineFor(language)
  const [result] = await engine.predict(input, {
    textDetLimitSideLen: 1600,
    textRecScoreThresh: 0.32,
  })

  const raw: OcrLine[] = (result?.items ?? [])
    .filter(item => typeof item.text === 'string' && item.text.trim())
    .map(item => ({
      text: item.text.trim(),
      score: Number(item.score ?? 0),
      poly: Array.isArray(item.poly)
        ? item.poly.map(point => [Number(point[0]), Number(point[1])])
        : [],
    }))

  const lines = normalizeLines(raw)
  const averageConfidence = lines.length
    ? lines.reduce((sum, line) => sum + line.score, 0) / lines.length
    : 0

  return {
    text: lines.map(line => line.text).join('\n'),
    lines,
    averageConfidence,
  }
}

export async function runPaddleOcr(
  input: Blob | HTMLCanvasElement,
  language: OcrLanguage,
) {
  if (language === 'en') return runSingle(input, 'en')
  if (language === 'hi') return runSingle(input, 'hi')

  try {
    const mixed = await runSingle(input, 'hi')

    if (mixed.text.length >= 30 && mixed.averageConfidence >= 0.45) {
      return mixed
    }
  } catch {
    // Auto mode falls back to English below.
  }

  return runSingle(input, 'en')
}
