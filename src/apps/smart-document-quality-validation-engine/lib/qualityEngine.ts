import { readDocumentForValidation, createOcrSession, type OcrSession } from './documentReader'
import { validateRequiredFields } from './fieldValidation'
import { analyzeTextQuality } from './textQuality'
import { hashSimilarity } from './visualQuality'
import type {
  DocumentQualityReport,
  DocumentValidationOptions,
  DuplicatePageGroup,
  FieldValidationResult,
  QualityFinding,
  ValidationDecision,
} from './types'

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function gradeForScore(score: number): DocumentQualityReport['grade'] {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function fieldScore(results: FieldValidationResult[]) {
  const required = results.filter((field) => field.required)
  if (!required.length) return 100
  const valid = required.filter((field) => field.found && !field.error).length
  return Math.round(valid / required.length * 100)
}

function findDuplicateGroups(hashes: Array<{ pageNumber: number; hash: string }>): DuplicatePageGroup[] {
  const groups: DuplicatePageGroup[] = []
  const used = new Set<number>()
  for (let index = 0; index < hashes.length; index += 1) {
    if (used.has(index)) continue
    const pages = [hashes[index].pageNumber]
    let strongest = 0
    for (let candidate = index + 1; candidate < hashes.length; candidate += 1) {
      if (used.has(candidate)) continue
      const similarity = hashSimilarity(hashes[index].hash, hashes[candidate].hash)
      if (similarity >= 0.92) {
        pages.push(hashes[candidate].pageNumber)
        strongest = Math.max(strongest, similarity)
        used.add(candidate)
      }
    }
    if (pages.length > 1) {
      used.add(index)
      groups.push({ pages, similarity: Math.round(strongest * 1000) / 1000 })
    }
  }
  return groups
}

function calculateScore(options: {
  visualScores: number[]
  textScore?: number
  requiredFieldScore?: number
}) {
  const parts: Array<{ value: number; weight: number }> = []
  if (options.visualScores.length) parts.push({ value: average(options.visualScores), weight: 0.58 })
  if (options.textScore !== undefined) parts.push({ value: options.textScore, weight: 0.27 })
  if (options.requiredFieldScore !== undefined) parts.push({ value: options.requiredFieldScore, weight: 0.15 })
  if (!parts.length) return 0
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0)
  return Math.round(parts.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight)
}

function decisionFor(score: number, threshold: number, findings: QualityFinding[]): ValidationDecision {
  const errors = findings.filter((finding) => finding.severity === 'error')
  const warnings = findings.filter((finding) => finding.severity === 'warning')
  if (errors.length > 0 || score < Math.max(0, threshold - 15)) return 'fail'
  if (score < threshold || warnings.length > 0) return 'review'
  return 'pass'
}

function summaryFor(decision: ValidationDecision, score: number, findings: QualityFinding[]) {
  const errors = findings.filter((finding) => finding.severity === 'error').length
  const warnings = findings.filter((finding) => finding.severity === 'warning').length
  if (decision === 'pass') return `Passed validation with a quality score of ${score}/100.`
  if (decision === 'review') return `Manual review recommended: score ${score}/100 with ${warnings} warning${warnings === 1 ? '' : 's'}.`
  return `Validation failed: score ${score}/100 with ${errors} error${errors === 1 ? '' : 's'} and ${warnings} warning${warnings === 1 ? '' : 's'}.`
}

export async function validateDocumentFile(
  file: File,
  options: DocumentValidationOptions & { ocrSession?: OcrSession },
): Promise<DocumentQualityReport> {
  const ownOcrSession = options.useOcr && !options.ocrSession
    ? createOcrSession(options.language, (progress, status) => options.onProgress?.(Math.min(88, 20 + Math.round(progress * 0.65)), status))
    : undefined
  const ocrSession = options.ocrSession ?? ownOcrSession

  try {
    options.onProgress?.(2, 'Checking file integrity')
    const read = await readDocumentForValidation(file, {
      useOcr: options.useOcr,
      language: options.language,
      maxPdfPages: options.maxPdfPages,
      maxOcrPages: options.maxOcrPages,
      ocrSession,
      onProgress: options.onProgress,
    })
    options.onProgress?.(92, 'Calculating quality and validation score')

    const textMetrics = analyzeTextQuality(read.text)
    const fieldResults = validateRequiredFields({
      text: read.text,
      preset: options.preset,
      customKeywords: options.customKeywords,
      customPatterns: options.customPatterns,
    })
    const duplicateGroups = options.detectDuplicates
      ? findDuplicateGroups(read.pageMetrics.map((page) => ({ pageNumber: page.pageNumber, hash: page.perceptualHash })))
      : []

    const hasUsableText = read.text.trim().length > 0
    const findings: QualityFinding[] = [
      ...read.pageMetrics.flatMap((page) => page.findings),
    ]
    if (hasUsableText || read.pageMetrics.length === 0 || (options.useOcr && read.ocrPages > 0)) {
      findings.push(...textMetrics.findings)
    } else {
      findings.push({
        id: 'text-validation-unavailable',
        severity: 'warning',
        code: 'text-validation-unavailable',
        title: 'Text validation was not completed',
        message: 'OCR is disabled or no text layer was available, so readability and required-field conclusions are limited.',
      })
    }

    fieldResults.forEach((field) => {
      if (field.error) {
        findings.push({
          id: `field-error-${field.id}`,
          severity: 'error',
          code: 'invalid-custom-pattern',
          title: `Invalid validation pattern: ${field.label}`,
          message: field.error,
        })
      } else if (field.required && !field.found) {
        findings.push({
          id: `field-missing-${field.id}`,
          severity: 'error',
          code: 'missing-required-field',
          title: `Missing required field: ${field.label}`,
          message: 'The required value was not found in embedded text or OCR output.',
        })
      }
    })

    duplicateGroups.forEach((group, index) => findings.push({
      id: `duplicate-pages-${index}`,
      severity: 'warning',
      code: 'duplicate-pages',
      title: 'Possible duplicate pages',
      message: `Pages ${group.pages.join(', ')} have ${Math.round(group.similarity * 100)}% visual similarity.`,
    }))

    if (file.size > 30 * 1024 * 1024) findings.push({
      id: 'large-file',
      severity: 'info',
      code: 'large-file',
      title: 'Large browser workload',
      message: `The file is ${(file.size / 1024 / 1024).toFixed(1)} MB; processing may use significant memory on mobile devices.`,
    })
    if (read.truncated) findings.push({
      id: 'partial-validation',
      severity: 'warning',
      code: 'partial-validation',
      title: 'Partial document validation',
      message: 'Browser performance limits prevented every page or all extracted text from being validated.',
    })

    const hasRequiredFields = fieldResults.some((field) => field.required)
    const score = calculateScore({
      visualScores: read.pageMetrics.map((page) => page.visualScore),
      textScore: hasUsableText ? textMetrics.score : undefined,
      requiredFieldScore: hasRequiredFields ? fieldScore(fieldResults) : undefined,
    })
    const decision = decisionFor(score, options.threshold, findings)

    return {
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      generatedAt: new Date().toISOString(),
      extractionMethod: read.method,
      pagesRead: read.pagesRead,
      ocrPages: read.ocrPages,
      truncated: read.truncated,
      score,
      threshold: options.threshold,
      decision,
      grade: gradeForScore(score),
      summary: summaryFor(decision, score, findings),
      findings,
      pageMetrics: read.pageMetrics,
      textMetrics,
      fieldResults,
      duplicateGroups,
      extractedText: options.includeExtractedText ? read.text : '',
      warnings: read.warnings,
      capabilityNotes: read.capabilityNotes,
    }
  } finally {
    if (ownOcrSession) await ownOcrSession.dispose()
  }
}

export function reportFileName(fileName: string, format: 'json' | 'csv') {
  const base = fileName.replace(/\.[^/.]+$/, '') || 'document'
  return `${base}-quality-validation.${format}`
}
