import type { CustomPatternInput, FieldValidationResult, ValidationPreset } from './types'

interface PresetField {
  id: string
  label: string
  patterns: RegExp[]
  required: boolean
}

const PRESET_FIELDS: Record<Exclude<ValidationPreset, 'general' | 'custom'>, PresetField[]> = {
  invoice: [
    { id: 'invoice-number', label: 'Invoice number', required: true, patterns: [/\b(?:invoice|inv)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/-]{2,})\b/i] },
    { id: 'invoice-date', label: 'Invoice date', required: true, patterns: [/\b(?:invoice\s*)?date\s*[:\-]?\s*((?:\d{1,2}[\/-]){2}\d{2,4})\b/i, /\bdate\s*[:\-]?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})\b/i] },
    { id: 'invoice-total', label: 'Grand total', required: true, patterns: [/\b(?:grand\s+total|amount\s+due|invoice\s+total|total)\s*[:\-]?\s*(?:₹|Rs\.?|INR|\$)?\s*([\d,]+(?:\.\d{1,2})?)\b/i] },
    { id: 'gstin', label: 'GSTIN', required: false, patterns: [/\b(\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d])\b/i] },
    { id: 'vendor', label: 'Vendor / supplier', required: false, patterns: [/\b(?:vendor|supplier|from)\s*[:\-]\s*([^\n]{3,80})/i] },
  ],
  receipt: [
    { id: 'receipt-number', label: 'Receipt number', required: true, patterns: [/\b(?:receipt|txn|transaction)\s*(?:no\.?|number|id|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/-]{2,})\b/i] },
    { id: 'receipt-date', label: 'Receipt date', required: true, patterns: [/\b(?:date|dated)\s*[:\-]?\s*((?:\d{1,2}[\/-]){2}\d{2,4})\b/i] },
    { id: 'receipt-total', label: 'Paid amount / total', required: true, patterns: [/\b(?:amount\s+paid|paid|total)\s*[:\-]?\s*(?:₹|Rs\.?|INR|\$)?\s*([\d,]+(?:\.\d{1,2})?)\b/i] },
  ],
  'bank-statement': [
    { id: 'account-holder', label: 'Account holder', required: true, patterns: [/\b(?:account\s+holder|customer\s+name|name)\s*[:\-]\s*([^\n]{3,80})/i] },
    { id: 'account-number', label: 'Account number', required: true, patterns: [/\b(?:account|a\/c)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([Xx*\d][Xx*\d\s-]{5,22})\b/i] },
    { id: 'statement-period', label: 'Statement period', required: true, patterns: [/\b(?:statement\s+period|period|from)\s*[:\-]?\s*([^\n]{4,80})/i] },
    { id: 'ifsc', label: 'IFSC', required: false, patterns: [/\b([A-Z]{4}0[A-Z0-9]{6})\b/i] },
  ],
  'identity-document': [
    { id: 'person-name', label: 'Person name', required: true, patterns: [/\b(?:name|नाम)\s*[:\-]?\s*([^\n]{3,80})/i] },
    { id: 'date-of-birth', label: 'Date of birth', required: true, patterns: [/\b(?:dob|date\s+of\s+birth|जन्म\s+तिथि)\s*[:\-]?\s*((?:\d{1,2}[\/-]){2}\d{2,4})\b/i] },
    { id: 'identity-number', label: 'Identity number', required: true, patterns: [/\b(\d{4}\s?\d{4}\s?\d{4})\b/, /\b([A-Z]{5}\d{4}[A-Z])\b/i, /\b([A-Z]{1,3}\d{6,12})\b/i] },
  ],
}

function runPatterns(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return (match[1] ?? match[0]).trim().slice(0, 140)
  }
  return undefined
}

export function validateRequiredFields(options: {
  text: string
  preset: ValidationPreset
  customKeywords: string[]
  customPatterns: CustomPatternInput[]
}): FieldValidationResult[] {
  const results: FieldValidationResult[] = []
  if (options.preset !== 'general' && options.preset !== 'custom') {
    for (const field of PRESET_FIELDS[options.preset]) {
      const value = runPatterns(options.text, field.patterns)
      results.push({
        id: field.id,
        label: field.label,
        required: field.required,
        found: Boolean(value),
        value,
        source: 'preset',
      })
    }
  }

  const lowerText = options.text.toLowerCase()
  options.customKeywords.forEach((keyword, index) => {
    const clean = keyword.trim()
    if (!clean) return
    results.push({
      id: `custom-keyword-${index}`,
      label: `Contains “${clean}”`,
      required: true,
      found: lowerText.includes(clean.toLowerCase()),
      value: lowerText.includes(clean.toLowerCase()) ? clean : undefined,
      source: 'custom-keyword',
    })
  })

  options.customPatterns.forEach((input, index) => {
    const label = input.label.trim() || `Custom pattern ${index + 1}`
    try {
      const expression = new RegExp(input.pattern, 'im')
      const match = options.text.match(expression)
      results.push({
        id: `custom-pattern-${index}`,
        label,
        required: true,
        found: Boolean(match),
        value: match ? (match[1] ?? match[0]).trim().slice(0, 140) : undefined,
        source: 'custom-pattern',
      })
    } catch (error) {
      results.push({
        id: `custom-pattern-${index}`,
        label,
        required: true,
        found: false,
        source: 'custom-pattern',
        error: error instanceof Error ? error.message : 'Invalid regular expression',
      })
    }
  })

  return results
}
