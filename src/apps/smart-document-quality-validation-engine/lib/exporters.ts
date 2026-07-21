import type { DocumentQualityReport } from './types'

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export function reportsToJson(reports: DocumentQualityReport[], includeText = false) {
  const safe = reports.map((report) => ({
    ...report,
    extractedText: includeText ? report.extractedText : undefined,
  }))
  return JSON.stringify(safe, null, 2)
}

export function reportsToCsv(reports: DocumentQualityReport[]) {
  const header = [
    'File', 'Type', 'Size bytes', 'Decision', 'Score', 'Grade', 'Threshold', 'Pages checked', 'OCR pages',
    'Errors', 'Warnings', 'Text words', 'Text quality', 'Average visual quality', 'Missing required fields', 'Duplicate page groups', 'Summary',
  ]
  const rows = reports.map((report) => {
    const errors = report.findings.filter((finding) => finding.severity === 'error').length
    const warnings = report.findings.filter((finding) => finding.severity === 'warning').length
    const visualAverage = report.pageMetrics.length
      ? Math.round(report.pageMetrics.reduce((sum, page) => sum + page.visualScore, 0) / report.pageMetrics.length)
      : ''
    const missing = report.fieldResults.filter((field) => field.required && !field.found).map((field) => field.label).join(' | ')
    return [
      report.fileName, report.fileType, report.fileSize, report.decision, report.score, report.grade, report.threshold,
      report.pagesRead, report.ocrPages, errors, warnings, report.textMetrics.words, report.textMetrics.score,
      visualAverage, missing, report.duplicateGroups.length, report.summary,
    ].map(csvCell).join(',')
  })
  return [header.map(csvCell).join(','), ...rows].join('\n')
}
