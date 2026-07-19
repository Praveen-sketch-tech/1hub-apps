import JSZip from 'jszip'
import type { GeneratedAsset } from '../types'
import { generateSampleRecords } from './dataFactory'

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function colName(index: number): string {
  let value = index + 1
  let out = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    out = String.fromCharCode(65 + remainder) + out
    value = Math.floor((value - 1) / 26)
  }
  return out
}

function inlineCell(ref: string, value: unknown): string {
  if (typeof value === 'number') return `<c r="${ref}" t="n"><v>${value}</v></c>`
  const text = value == null ? '' : String(value)
  return `<c r="${ref}" t="inlineStr"><is><t>${esc(text)}</t></is></c>`
}

function worksheetXml(rows: Array<Array<unknown>>, formulas = false): string {
  const xmlRows = rows.map((row, rIndex) => {
    const cells = row.map((value, cIndex) => {
      const ref = `${colName(cIndex)}${rIndex + 1}`
      if (formulas && rIndex > 0 && cIndex === row.length - 1) {
        return `<c r="${ref}" t="n"><f>H${rIndex + 1}*I${rIndex + 1}*(1-IF(J${rIndex + 1}="",0,J${rIndex + 1})/100)</f><v>0</v></c>`
      }
      return inlineCell(ref, value)
    }).join('')
    return `<row r="${rIndex + 1}">${cells}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows}</sheetData></worksheet>`
}

export async function generateXlsxAsset(options: {
  fileName?: string
  rowCount?: number
  sheetCount?: number
  includeDuplicates?: boolean
  includeMissingValues?: boolean
  includeFormulas?: boolean
  seed?: number
}): Promise<GeneratedAsset> {
  const records = generateSampleRecords(options)
  const headers = ['ID', 'Customer', 'Email', 'City', 'Category', 'Status', 'Order Date', 'Quantity', 'Unit Price', 'Discount %', 'Total']
  const rows = [headers, ...records.map((r) => [r.id, r.customer, r.email ?? '', r.city, r.category, r.status, r.orderDate, r.quantity, r.unitPrice, r.discount ?? '', r.total])]
  const sheetCount = Math.max(1, Math.min(options.sheetCount ?? 2, 5))
  const zip = new JSZip()
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${Array.from({ length: sheetCount }, (_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`)
  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
  const sheetEntries = Array.from({ length: sheetCount }, (_, i) => `<sheet name="${i === 0 ? 'Orders' : `Sheet ${i + 1}`}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
  zip.folder('xl')?.file('workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets></workbook>`)
  zip.folder('xl')?.folder('_rels')?.file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${Array.from({ length: sheetCount }, (_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`)
  const ws = zip.folder('xl')?.folder('worksheets')
  ws?.file('sheet1.xml', worksheetXml(rows, Boolean(options.includeFormulas)))
  for (let i = 1; i < sheetCount; i += 1) {
    const summaryRows = [
      ['Metric', 'Value'],
      ['Generated Rows', records.length],
      ['Duplicate Scenario', options.includeDuplicates ? 'Yes' : 'No'],
      ['Missing Value Scenario', options.includeMissingValues ? 'Yes' : 'No'],
      ['Formula Scenario', options.includeFormulas ? 'Yes' : 'No'],
      ['Sheet Number', i + 1],
    ]
    ws?.file(`sheet${i + 1}.xml`, worksheetXml(summaryRows))
  }
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const base = (options.fileName ?? 'sample-workbook').trim().replace(/\.[^.]+$/, '') || 'sample-workbook'
  return {
    blob,
    fileName: `${base}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    assetType: 'xlsx',
    summary: `XLSX workbook with ${sheetCount} sheet(s), ${records.length} data rows${options.includeFormulas ? ', formulas' : ''}${options.includeDuplicates ? ', duplicate rows' : ''}${options.includeMissingValues ? ', and missing values' : ''}.`,
  }
}
