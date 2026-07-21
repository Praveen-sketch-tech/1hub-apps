import type {
  BuiltInDocumentCategory,
  CategoryScore,
  CustomClassificationRule,
  DocumentClassification,
} from './types'

interface WeightedKeyword {
  term: string
  weight: number
}

interface RuleDefinition {
  category: BuiltInDocumentCategory
  keywords: WeightedKeyword[]
  patterns?: Array<{ label: string; regex: RegExp; weight: number }>
  fileNameKeywords?: WeightedKeyword[]
}

const RULES: RuleDefinition[] = [
  {
    category: 'Invoice',
    keywords: [
      { term: 'invoice', weight: 7 },
      { term: 'invoice number', weight: 5 },
      { term: 'bill to', weight: 4 },
      { term: 'amount due', weight: 5 },
      { term: 'due date', weight: 3 },
      { term: 'subtotal', weight: 2 },
      { term: 'tax invoice', weight: 7 },
      { term: 'gstin', weight: 4 },
      { term: 'चालान', weight: 7 },
      { term: 'देय राशि', weight: 5 },
      { term: 'hsn', weight: 2 },
    ],
    patterns: [
      { label: 'invoice-number pattern', regex: /\binvoice\s*(?:no\.?|number|#)\s*[:#-]?\s*[a-z0-9/-]{3,}/i, weight: 6 },
      { label: 'amount-due pattern', regex: /\b(?:amount|balance)\s+due\b/i, weight: 4 },
    ],
    fileNameKeywords: [{ term: 'invoice', weight: 7 }, { term: 'bill', weight: 3 }],
  },
  {
    category: 'Receipt',
    keywords: [
      { term: 'receipt', weight: 7 },
      { term: 'payment received', weight: 5 },
      { term: 'paid', weight: 2 },
      { term: 'cashier', weight: 3 },
      { term: 'change due', weight: 4 },
      { term: 'payment method', weight: 4 },
      { term: 'transaction id', weight: 3 },
      { term: 'thank you for your purchase', weight: 5 },
      { term: 'रसीद', weight: 7 },
      { term: 'भुगतान प्राप्त', weight: 5 },
    ],
    patterns: [
      { label: 'receipt-number pattern', regex: /\breceipt\s*(?:no\.?|number|#)\s*[:#-]?\s*[a-z0-9/-]{3,}/i, weight: 6 },
    ],
    fileNameKeywords: [{ term: 'receipt', weight: 7 }],
  },
  {
    category: 'Bank Statement',
    keywords: [
      { term: 'bank statement', weight: 8 },
      { term: 'account statement', weight: 7 },
      { term: 'account number', weight: 4 },
      { term: 'opening balance', weight: 5 },
      { term: 'closing balance', weight: 5 },
      { term: 'withdrawal', weight: 3 },
      { term: 'deposit', weight: 3 },
      { term: 'ifsc', weight: 4 },
      { term: 'transaction date', weight: 3 },
      { term: 'available balance', weight: 4 },
      { term: 'बैंक विवरण', weight: 8 },
      { term: 'खाता संख्या', weight: 5 },
      { term: 'शेष राशि', weight: 4 },
    ],
    patterns: [
      { label: 'masked-account pattern', regex: /\b(?:a\/c|account)\s*(?:no\.?|number)?\s*[:#-]?\s*[x*\d -]{6,}/i, weight: 4 },
    ],
    fileNameKeywords: [{ term: 'statement', weight: 5 }, { term: 'bank', weight: 4 }],
  },
  {
    category: 'Identity Document',
    keywords: [
      { term: 'aadhaar', weight: 9 },
      { term: 'aadhar', weight: 9 },
      { term: 'passport', weight: 8 },
      { term: 'driving licence', weight: 8 },
      { term: 'driving license', weight: 8 },
      { term: 'voter id', weight: 8 },
      { term: 'identity card', weight: 6 },
      { term: 'date of birth', weight: 3 },
      { term: 'government of india', weight: 5 },
      { term: 'unique identification authority', weight: 8 },
      { term: 'भारत सरकार', weight: 5 },
      { term: 'जन्म तिथि', weight: 3 },
      { term: 'आधार', weight: 9 },
    ],
    patterns: [
      { label: 'PAN-like pattern', regex: /\b[A-Z]{5}\d{4}[A-Z]\b/i, weight: 8 },
      { label: 'Aadhaar-like number pattern', regex: /\b\d{4}\s\d{4}\s\d{4}\b/, weight: 6 },
    ],
    fileNameKeywords: [
      { term: 'aadhaar', weight: 8 },
      { term: 'aadhar', weight: 8 },
      { term: 'passport', weight: 7 },
      { term: 'pan card', weight: 7 },
      { term: 'id card', weight: 6 },
    ],
  },
  {
    category: 'Resume / CV',
    keywords: [
      { term: 'curriculum vitae', weight: 9 },
      { term: 'resume', weight: 8 },
      { term: 'work experience', weight: 6 },
      { term: 'professional experience', weight: 6 },
      { term: 'career objective', weight: 5 },
      { term: 'skills', weight: 2 },
      { term: 'education', weight: 2 },
      { term: 'linkedin', weight: 3 },
      { term: 'references', weight: 2 },
    ],
    patterns: [
      { label: 'email/contact pattern', regex: /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i, weight: 1 },
    ],
    fileNameKeywords: [{ term: 'resume', weight: 8 }, { term: 'cv', weight: 7 }],
  },
  {
    category: 'Contract / Agreement',
    keywords: [
      { term: 'agreement', weight: 7 },
      { term: 'contract', weight: 7 },
      { term: 'terms and conditions', weight: 5 },
      { term: 'hereinafter', weight: 5 },
      { term: 'party of the first part', weight: 7 },
      { term: 'whereas', weight: 4 },
      { term: 'shall be governed', weight: 5 },
      { term: 'effective date', weight: 3 },
      { term: 'signature', weight: 2 },
      { term: 'अनुबंध', weight: 7 },
      { term: 'समझौता', weight: 7 },
    ],
    patterns: [
      { label: 'between-parties pattern', regex: /\b(?:agreement|contract)\b[\s\S]{0,120}\bbetween\b/i, weight: 5 },
    ],
    fileNameKeywords: [{ term: 'agreement', weight: 7 }, { term: 'contract', weight: 7 }, { term: 'nda', weight: 6 }],
  },
  {
    category: 'Letter / Notice',
    keywords: [
      { term: 'dear sir', weight: 4 },
      { term: 'dear madam', weight: 4 },
      { term: 'to whom it may concern', weight: 6 },
      { term: 'subject:', weight: 3 },
      { term: 'sincerely', weight: 3 },
      { term: 'notice', weight: 5 },
      { term: 'hereby informed', weight: 5 },
      { term: 'official communication', weight: 4 },
      { term: 'विषय', weight: 3 },
      { term: 'महोदय', weight: 4 },
      { term: 'सूचना', weight: 5 },
    ],
    patterns: [
      { label: 'dated-letter pattern', regex: /\bdate\s*:\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/i, weight: 2 },
    ],
    fileNameKeywords: [{ term: 'letter', weight: 5 }, { term: 'notice', weight: 6 }],
  },
  {
    category: 'Form / Application',
    keywords: [
      { term: 'application form', weight: 8 },
      { term: 'applicant name', weight: 5 },
      { term: 'please fill', weight: 5 },
      { term: 'tick the appropriate', weight: 5 },
      { term: 'signature of applicant', weight: 6 },
      { term: 'declaration by applicant', weight: 6 },
      { term: 'form no', weight: 4 },
      { term: 'आवेदन पत्र', weight: 8 },
      { term: 'आवेदक', weight: 5 },
    ],
    patterns: [
      { label: 'blank-field pattern', regex: /_{4,}|\.{5,}/, weight: 2 },
    ],
    fileNameKeywords: [{ term: 'application', weight: 6 }, { term: 'form', weight: 5 }],
  },
  {
    category: 'Certificate',
    keywords: [
      { term: 'certificate', weight: 7 },
      { term: 'this is to certify', weight: 8 },
      { term: 'certifies that', weight: 7 },
      { term: 'awarded to', weight: 6 },
      { term: 'has successfully completed', weight: 6 },
      { term: 'date of issue', weight: 3 },
      { term: 'प्रमाण पत्र', weight: 8 },
      { term: 'प्रमाणित किया जाता है', weight: 7 },
    ],
    fileNameKeywords: [{ term: 'certificate', weight: 7 }, { term: 'cert', weight: 4 }],
  },
  {
    category: 'Report',
    keywords: [
      { term: 'executive summary', weight: 6 },
      { term: 'methodology', weight: 4 },
      { term: 'findings', weight: 4 },
      { term: 'conclusion', weight: 3 },
      { term: 'recommendations', weight: 4 },
      { term: 'table of contents', weight: 3 },
      { term: 'report', weight: 3 },
      { term: 'analysis', weight: 2 },
    ],
    fileNameKeywords: [{ term: 'report', weight: 6 }, { term: 'analysis', weight: 3 }],
  },
  {
    category: 'Tax Document',
    keywords: [
      { term: 'income tax', weight: 7 },
      { term: 'form 16', weight: 8 },
      { term: 'assessment year', weight: 6 },
      { term: 'tax deducted at source', weight: 7 },
      { term: 'tds', weight: 4 },
      { term: 'income tax department', weight: 7 },
      { term: 'gst return', weight: 7 },
      { term: 'taxable income', weight: 5 },
      { term: 'आयकर', weight: 7 },
      { term: 'निर्धारण वर्ष', weight: 6 },
    ],
    patterns: [
      { label: 'PAN-like pattern', regex: /\b[A-Z]{5}\d{4}[A-Z]\b/i, weight: 2 },
    ],
    fileNameKeywords: [{ term: 'form16', weight: 8 }, { term: 'tax', weight: 6 }, { term: 'itr', weight: 7 }],
  },
  {
    category: 'Medical Document',
    keywords: [
      { term: 'patient name', weight: 5 },
      { term: 'diagnosis', weight: 6 },
      { term: 'prescription', weight: 7 },
      { term: 'hospital', weight: 4 },
      { term: 'doctor', weight: 3 },
      { term: 'laboratory report', weight: 7 },
      { term: 'clinical', weight: 3 },
      { term: 'blood group', weight: 4 },
      { term: 'medicine', weight: 3 },
      { term: 'रोगी', weight: 5 },
      { term: 'निदान', weight: 6 },
      { term: 'दवा', weight: 3 },
    ],
    patterns: [
      { label: 'dosage pattern', regex: /\b\d+\s*(?:mg|ml|mcg)\b/i, weight: 3 },
    ],
    fileNameKeywords: [{ term: 'medical', weight: 6 }, { term: 'prescription', weight: 7 }, { term: 'lab report', weight: 7 }],
  },
  {
    category: 'Education Document',
    keywords: [
      { term: 'marksheet', weight: 8 },
      { term: 'mark sheet', weight: 8 },
      { term: 'university', weight: 4 },
      { term: 'school', weight: 3 },
      { term: 'semester', weight: 5 },
      { term: 'roll number', weight: 5 },
      { term: 'grade', weight: 3 },
      { term: 'examination', weight: 4 },
      { term: 'academic year', weight: 4 },
      { term: 'अंकसूची', weight: 8 },
      { term: 'अनुक्रमांक', weight: 5 },
    ],
    fileNameKeywords: [{ term: 'marksheet', weight: 8 }, { term: 'degree', weight: 6 }, { term: 'result', weight: 4 }],
  },
  {
    category: 'Payslip',
    keywords: [
      { term: 'salary slip', weight: 9 },
      { term: 'payslip', weight: 9 },
      { term: 'gross salary', weight: 6 },
      { term: 'net pay', weight: 6 },
      { term: 'basic salary', weight: 5 },
      { term: 'employee id', weight: 4 },
      { term: 'provident fund', weight: 4 },
      { term: 'earnings', weight: 3 },
      { term: 'deductions', weight: 3 },
      { term: 'वेतन पर्ची', weight: 9 },
      { term: 'कुल वेतन', weight: 6 },
    ],
    fileNameKeywords: [{ term: 'payslip', weight: 9 }, { term: 'salary slip', weight: 9 }],
  },
  {
    category: 'Purchase Order',
    keywords: [
      { term: 'purchase order', weight: 9 },
      { term: 'po number', weight: 6 },
      { term: 'vendor', weight: 3 },
      { term: 'ship to', weight: 3 },
      { term: 'delivery date', weight: 3 },
      { term: 'ordered by', weight: 4 },
      { term: 'unit price', weight: 3 },
    ],
    patterns: [
      { label: 'PO-number pattern', regex: /\bP\.?O\.?\s*(?:no\.?|number|#)\s*[:#-]?\s*[a-z0-9/-]{3,}/i, weight: 6 },
    ],
    fileNameKeywords: [{ term: 'purchase order', weight: 9 }, { term: 'po-', weight: 5 }],
  },
]

export const BUILT_IN_CATEGORIES: BuiltInDocumentCategory[] = [
  ...RULES.map((rule) => rule.category),
  'Other',
]

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\p{L}\p{N}#@.+:/_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function countOccurrences(text: string, term: string) {
  if (!term) return 0
  let count = 0
  let index = 0
  while (index < text.length) {
    const next = text.indexOf(term, index)
    if (next === -1) break
    count += 1
    index = next + term.length
    if (count >= 3) break
  }
  return count
}

function addSignal(
  score: CategoryScore,
  label: string,
  weight: number,
  occurrenceMultiplier = 1,
) {
  score.score += weight * occurrenceMultiplier
  if (!score.matchedSignals.includes(label)) score.matchedSignals.push(label)
}

function scoreRule(text: string, fileName: string, rule: RuleDefinition): CategoryScore {
  const score: CategoryScore = { category: rule.category, score: 0, matchedSignals: [] }

  for (const keyword of rule.keywords) {
    const occurrences = countOccurrences(text, normalize(keyword.term))
    if (occurrences > 0) {
      addSignal(score, keyword.term, keyword.weight, 1 + Math.min(occurrences - 1, 2) * 0.35)
    }
  }

  for (const keyword of rule.fileNameKeywords ?? []) {
    if (fileName.includes(normalize(keyword.term))) {
      addSignal(score, `filename: ${keyword.term}`, keyword.weight)
    }
  }

  for (const pattern of rule.patterns ?? []) {
    pattern.regex.lastIndex = 0
    if (pattern.regex.test(text)) addSignal(score, pattern.label, pattern.weight)
  }

  return score
}

function scoreCustomRule(
  text: string,
  fileName: string,
  rule: CustomClassificationRule,
): CategoryScore {
  const score: CategoryScore = { category: rule.category.trim(), score: 0, matchedSignals: [] }
  for (const rawKeyword of rule.keywords) {
    const keyword = normalize(rawKeyword)
    if (!keyword) continue
    const occurrences = countOccurrences(text, keyword)
    if (occurrences > 0) addSignal(score, rawKeyword, 6, 1 + Math.min(occurrences - 1, 2) * 0.4)
    if (fileName.includes(keyword)) addSignal(score, `filename: ${rawKeyword}`, 7)
  }
  return score
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10
}

export function classifyDocument(input: {
  text: string
  fileName: string
  customRules?: CustomClassificationRule[]
}): DocumentClassification {
  const normalizedText = normalize(input.text).slice(0, 300_000)
  const normalizedFileName = normalize(input.fileName.replace(/\.[^.]+$/, ''))
  const builtInScores = RULES.map((rule) => scoreRule(normalizedText, normalizedFileName, rule))
  const customScores = (input.customRules ?? [])
    .filter((rule) => rule.category.trim() && rule.keywords.some((keyword) => keyword.trim()))
    .map((rule) => scoreCustomRule(normalizedText, normalizedFileName, rule))

  const scores = [...builtInScores, ...customScores]
    .map((score) => ({ ...score, score: roundScore(score.score) }))
    .sort((a, b) => b.score - a.score || a.category.localeCompare(b.category))

  const top = scores[0]
  const second = scores[1]

  if (!top || top.score <= 0) {
    return {
      category: 'Other',
      confidence: 20,
      lowConfidence: true,
      matchedSignals: [],
      reasons: ['No category-specific keyword or pattern was found.'],
      scores: scores.slice(0, 5),
    }
  }

  const margin = top.score - (second?.score ?? 0)
  const evidence = top.matchedSignals.length
  const confidence = Math.max(
    35,
    Math.min(98, Math.round(38 + Math.min(top.score, 28) * 1.45 + Math.min(margin, 12) * 1.8 + Math.min(evidence, 5) * 2)),
  )
  const lowConfidence = confidence < 68 || top.score < 7 || margin < 2
  const reasons = [
    top.matchedSignals.length
      ? `Matched ${top.matchedSignals.slice(0, 5).join(', ')}.`
      : 'Classification was based on weak filename evidence.',
  ]

  if (second && second.score > 0) {
    reasons.push(`${second.category} was the next closest category with score ${roundScore(second.score)}.`)
  }
  if (lowConfidence) {
    reasons.push('Review recommended because the evidence or winning margin is limited.')
  }

  return {
    category: top.category,
    confidence,
    lowConfidence,
    runnerUp: second?.score ? second.category : undefined,
    matchedSignals: top.matchedSignals,
    reasons,
    scores: scores.slice(0, 5),
  }
}
