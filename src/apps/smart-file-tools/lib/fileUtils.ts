import type { FileRecord, RenameRules, SortDirection, SortKey } from './types'

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function baseNameOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

export function makeRecords(files: File[]): FileRecord[] {
  return files.map((file) => ({
    id: crypto.randomUUID(),
    file,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    extension: extensionOf(file.name),
    modified: file.lastModified,
  }))
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 2)} ${units[i]}`
}

export function renamedName(name: string, index: number, rules: RenameRules): string {
  const ext = extensionOf(name)
  let base = baseNameOf(name)

  if (rules.find) {
    try {
      if (rules.useRegex) {
        base = base.replace(new RegExp(rules.find, 'g'), rules.replace)
      } else {
        base = base.split(rules.find).join(rules.replace)
      }
    } catch {
      // Invalid user regex: keep original base name.
    }
  }

  const seq = rules.addSequence
    ? `${String(rules.startNumber + index).padStart(Math.max(1, rules.pad), '0')}-`
    : ''

  return `${rules.prefix}${seq}${base}${rules.suffix}${ext ? `.${ext}` : ''}`
}

export function sortRecords(records: FileRecord[], key: SortKey, direction: SortDirection): FileRecord[] {
  const factor = direction === 'asc' ? 1 : -1
  return [...records].sort((a, b) => {
    let result = 0
    if (key === 'name') result = a.name.localeCompare(b.name)
    if (key === 'size') result = a.size - b.size
    if (key === 'type') result = a.type.localeCompare(b.type)
    if (key === 'modified') result = a.modified - b.modified
    return result * factor
  })
}

export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'file'
}
