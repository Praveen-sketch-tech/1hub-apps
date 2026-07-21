import type { QualityFinding, TextQualityMetrics } from './types'

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

export function analyzeTextQuality(text: string): TextQualityMetrics {
  const normalized = text.replace(/\r/g, '')
  const characters = normalized.length
  const words = normalized.trim() ? normalized.trim().split(/\s+/).filter(Boolean).length : 0
  const lines = normalized ? normalized.split('\n').length : 0
  const alphanumeric = (normalized.match(/[\p{L}\p{N}]/gu) ?? []).length
  const symbols = (normalized.match(/[^\p{L}\p{N}\s.,:;!?()\-\/'"₹$€£%+@#&]/gu) ?? []).length
  const replacementCharacters = (normalized.match(/�/g) ?? []).length
  const repeatedCharacterRuns = (normalized.match(/(.)\1{5,}/g) ?? []).length
  const denominator = Math.max(1, characters)
  const alphanumericRatio = alphanumeric / denominator
  const symbolNoiseRatio = symbols / denominator

  let score = 100
  const findings: QualityFinding[] = []
  const add = (severity: QualityFinding['severity'], code: string, title: string, message: string) => findings.push({
    id: `text-${code}`,
    severity,
    code,
    title,
    message,
  })

  if (characters === 0) {
    score = 0
    add('error', 'no-readable-text', 'No readable text found', 'The document has no embedded text and OCR did not produce usable text.')
  } else {
    if (words < 5) {
      score -= 35
      add('warning', 'very-short-text', 'Very little readable text', `Only ${words} word${words === 1 ? '' : 's'} were detected.`)
    } else if (words < 20) {
      score -= 15
      add('info', 'short-text', 'Limited text content', `Only ${words} words were detected; verify that the document is complete.`)
    }
    if (alphanumericRatio < 0.35) {
      score -= 35
      add('error', 'gibberish-text', 'Text appears noisy', 'A low share of extracted characters are letters or numbers.')
    } else if (alphanumericRatio < 0.52) {
      score -= 18
      add('warning', 'weak-text-quality', 'Extracted text quality is weak', 'OCR or embedded text contains many separators or non-text characters.')
    }
    if (symbolNoiseRatio > 0.08) {
      score -= 28
      add('error', 'symbol-noise', 'Heavy OCR symbol noise', 'Unexpected symbols make up a large part of the extracted text.')
    } else if (symbolNoiseRatio > 0.03) {
      score -= 12
      add('warning', 'some-symbol-noise', 'Some OCR symbol noise', 'Unexpected symbols were found in the extracted text.')
    }
    if (replacementCharacters > 0) {
      score -= Math.min(20, replacementCharacters * 3)
      add('warning', 'replacement-characters', 'Unreadable characters detected', `${replacementCharacters} replacement character${replacementCharacters === 1 ? '' : 's'} were found.`)
    }
    if (repeatedCharacterRuns > 0) {
      score -= Math.min(18, repeatedCharacterRuns * 5)
      add('warning', 'repeated-character-noise', 'Repeated-character OCR noise', `${repeatedCharacterRuns} suspicious repeated-character run${repeatedCharacterRuns === 1 ? '' : 's'} were found.`)
    }
  }

  return {
    characters,
    words,
    lines,
    alphanumericRatio: Math.round(alphanumericRatio * 1000) / 1000,
    symbolNoiseRatio: Math.round(symbolNoiseRatio * 1000) / 1000,
    replacementCharacters,
    repeatedCharacterRuns,
    score: Math.round(clamp(score)),
    findings,
  }
}
