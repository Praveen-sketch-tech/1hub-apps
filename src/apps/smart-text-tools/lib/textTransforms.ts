import type { CaseMode, ExtractMode, TextStats } from '../types'

export function getTextStats(text: string): TextStats {
  const trimmed = text.trim()
  return {
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    lines: text ? text.split(/\r?\n/).length : 0,
    sentences: trimmed ? (trimmed.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? []).length : 0,
    bytes: new Blob([text]).size,
  }
}

export function cleanText(
  text: string,
  options: {
    trimLines: boolean
    removeExtraSpaces: boolean
    removeBlankLines: boolean
    normalizeLineBreaks: boolean
    removeHtml: boolean
  },
): string {
  let result = text
  if (options.removeHtml) {
    const doc = new DOMParser().parseFromString(result, 'text/html')
    result = doc.body.textContent ?? ''
  }
  if (options.normalizeLineBreaks) result = result.replace(/\r\n?/g, '\n')
  let lines = result.split('\n')
  if (options.trimLines) lines = lines.map((line) => line.trim())
  if (options.removeExtraSpaces) lines = lines.map((line) => line.replace(/[ \t]+/g, ' '))
  if (options.removeBlankLines) lines = lines.filter((line) => line.trim())
  return lines.join('\n').trim()
}

function wordsFromText(text: string): string[] {
  return text
    .trim()
    .split(/[\s_-]+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(Boolean)
}

export function convertCase(text: string, mode: CaseMode): string {
  switch (mode) {
    case 'uppercase': return text.toUpperCase()
    case 'lowercase': return text.toLowerCase()
    case 'title':
      return text.toLowerCase().replace(/\b\p{L}/gu, (character) => character.toUpperCase())
    case 'sentence':
      return text.toLowerCase().replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, (match) => match.toUpperCase())
    case 'camel': {
      const words = wordsFromText(text)
      return words.map((word, index) =>
        index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join('')
    }
    case 'kebab': return wordsFromText(text).map((word) => word.toLowerCase()).join('-')
    case 'snake': return wordsFromText(text).map((word) => word.toLowerCase()).join('_')
  }
}

export function removeDuplicateLines(
  text: string,
  options: { caseSensitive: boolean; keepEmpty: boolean },
): string {
  const seen = new Set<string>()
  const output: string[] = []
  for (const line of text.split(/\r?\n/)) {
    if (!options.keepEmpty && !line.trim()) continue
    const key = options.caseSensitive ? line : line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(line)
  }
  return output.join('\n')
}

export function sortLines(
  text: string,
  direction: 'asc' | 'desc',
  options: { numeric: boolean; caseSensitive: boolean },
): string {
  const collator = new Intl.Collator(undefined, {
    numeric: options.numeric,
    sensitivity: options.caseSensitive ? 'variant' : 'base',
  })
  return [...text.split(/\r?\n/)]
    .sort((a, b) => direction === 'asc' ? collator.compare(a, b) : collator.compare(b, a))
    .join('\n')
}

export function addPrefixSuffix(
  text: string,
  prefix: string,
  suffix: string,
  skipEmpty: boolean,
): string {
  return text.split(/\r?\n/)
    .map((line) => skipEmpty && !line.trim() ? line : `${prefix}${line}${suffix}`)
    .join('\n')
}

export function extractValues(text: string, mode: ExtractMode): string[] {
  const matches =
    mode === 'emails'
      ? text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)
      : mode === 'urls'
        ? text.match(/\bhttps?:\/\/[^\s<>"']+/gi)
        : text.match(/(?:\+?\d[\d\s().-]{6,}\d)/g)
  return Array.from(new Set((matches ?? []).map((value) => value.trim())))
}

export function findAndReplace(
  text: string,
  find: string,
  replacement: string,
  options: { caseSensitive: boolean; wholeWord: boolean },
): { result: string; count: number } {
  if (!find) return { result: text, count: 0 }
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = `${options.wholeWord ? '\\b' : ''}${escaped}${options.wholeWord ? '\\b' : ''}`
  const regex = new RegExp(pattern, options.caseSensitive ? 'g' : 'gi')
  const matches = text.match(regex)
  return { result: text.replace(regex, replacement), count: matches?.length ?? 0 }
}
