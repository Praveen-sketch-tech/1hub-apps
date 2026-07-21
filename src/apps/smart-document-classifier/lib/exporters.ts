import { downloadText } from '@shared/utils/downloads'
import type { ClassifiedDocumentItem } from './types'

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function effectiveCategory(item: ClassifiedDocumentItem) {
  return item.overrideCategory || item.classification?.category || 'Unclassified'
}

export function exportClassificationCsv(items: ClassifiedDocumentItem[]) {
  const completed = items.filter((item) => item.classification)
  const rows = [
    ['File', 'Category', 'Suggested Category', 'Confidence', 'Low Confidence', 'Extraction Method', 'Pages Read', 'OCR Pages', 'Matched Signals', 'Warnings'],
    ...completed.map((item) => [
      item.file.name,
      effectiveCategory(item),
      item.classification?.category ?? '',
      item.classification?.confidence ?? '',
      item.classification?.lowConfidence ? 'Yes' : 'No',
      item.extraction?.method ?? '',
      item.extraction?.pagesRead ?? '',
      item.extraction?.ocrPages ?? '',
      item.classification?.matchedSignals.join(' | ') ?? '',
      item.extraction?.warnings.join(' | ') ?? '',
    ]),
  ]
  downloadText(rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'document-classification-results.csv', 'text/csv;charset=utf-8')
}

export function exportClassificationJson(items: ClassifiedDocumentItem[]) {
  const payload = items
    .filter((item) => item.classification)
    .map((item) => ({
      fileName: item.file.name,
      fileType: item.file.type,
      fileSize: item.file.size,
      category: effectiveCategory(item),
      suggestedCategory: item.classification?.category,
      confidence: item.classification?.confidence,
      lowConfidence: item.classification?.lowConfidence,
      runnerUp: item.classification?.runnerUp,
      matchedSignals: item.classification?.matchedSignals,
      reasons: item.classification?.reasons,
      extraction: item.extraction,
    }))
  downloadText(JSON.stringify(payload, null, 2), 'document-classification-results.json', 'application/json;charset=utf-8')
}
