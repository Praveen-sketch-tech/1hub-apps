import type { FileRecord } from './types'

function csvEscape(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function fileListText(records: FileRecord[]): string {
  return records.map((r) => `${r.name}\t${r.size}\t${r.type}\t${r.hash || ''}`).join('\n')
}

export function fileListCsv(records: FileRecord[]): string {
  const rows = [['Name', 'SizeBytes', 'MIME', 'Extension', 'Modified', 'SHA256']]
  for (const r of records) {
    rows.push([r.name, String(r.size), r.type, r.extension, new Date(r.modified).toISOString(), r.hash || ''])
  }
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n')
}

export function fileListJson(records: FileRecord[]): string {
  return JSON.stringify(records.map((r) => ({
    name: r.name,
    size: r.size,
    type: r.type,
    extension: r.extension,
    modified: new Date(r.modified).toISOString(),
    sha256: r.hash || null,
    duplicateGroup: r.duplicateGroup || null,
  })), null, 2)
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
