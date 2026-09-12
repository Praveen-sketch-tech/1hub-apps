import { UploadedFile } from '../types'
import { normalizeRelativePath } from './project'

// ---------------------------------------------------------------------------
// Building UploadedFile[] from a plain <input type="file"> FileList (supports
// webkitdirectory folder selection, which populates webkitRelativePath).
// ---------------------------------------------------------------------------

export function filesFromFileList(fileList: FileList): UploadedFile[] {
  const result: UploadedFile[] = []

  for (const file of Array.from(fileList)) {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath
    const rawPath = relative && relative.length > 0 ? relative : file.name
    const normalized = normalizeRelativePath(rawPath)
    if (!normalized) continue
    result.push({ path: normalized, file })
  }

  return result
}

// ---------------------------------------------------------------------------
// Building UploadedFile[] from a DataTransfer (drag & drop), recursively
// walking directories via the webkitGetAsEntry() API when available.
// ---------------------------------------------------------------------------

interface FileSystemEntryLike {
  isFile: boolean
  isDirectory: boolean
  fullPath: string
  name: string
  file: (success: (file: File) => void, error: (err: unknown) => void) => void
  createReader: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error: (err: unknown) => void,
    ) => void
  }
}

function readEntryAsFile(entry: FileSystemEntryLike): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

function readAllDirectoryEntries(
  reader: ReturnType<FileSystemEntryLike['createReader']>,
): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntryLike[] = []
    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(all)
          return
        }
        all.push(...entries)
        readBatch()
      }, reject)
    }
    readBatch()
  })
}

async function walkEntry(entry: FileSystemEntryLike, out: UploadedFile[]): Promise<void> {
  if (entry.isFile) {
    try {
      const file = await readEntryAsFile(entry)
      const normalized = normalizeRelativePath(entry.fullPath || file.name)
      if (normalized) out.push({ path: normalized, file })
    } catch {
      // Skip unreadable entries rather than failing the whole drop.
    }
    return
  }

  if (entry.isDirectory) {
    const reader = entry.createReader()
    const entries = await readAllDirectoryEntries(reader)
    for (const child of entries) {
      await walkEntry(child, out)
    }
  }
}

export async function filesFromDataTransfer(dataTransfer: DataTransfer): Promise<UploadedFile[]> {
  const items = Array.from(dataTransfer.items || [])
  const supportsEntries = items.length > 0 && typeof items[0].webkitGetAsEntry === 'function'

  if (!supportsEntries) {
    return filesFromFileList(dataTransfer.files)
  }

  const out: UploadedFile[] = []
  const entries = items
    .map((item) => item.webkitGetAsEntry?.() as FileSystemEntryLike | null)
    .filter((entry): entry is FileSystemEntryLike => Boolean(entry))

  for (const entry of entries) {
    await walkEntry(entry, out)
  }

  // Fallback: if entry traversal produced nothing (e.g. unsupported browser
  // API returned null for everything), fall back to the flat file list.
  if (out.length === 0) {
    return filesFromFileList(dataTransfer.files)
  }

  return out
}

// ---------------------------------------------------------------------------
// Encoding helpers used for both preview and GitHub blob upload.
// ---------------------------------------------------------------------------

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  return arrayBufferToBase64(buffer)
}

export async function textFileToUtf8Base64(file: File): Promise<string> {
  // Read as text first (handles BOM/encoding normalization the same way the
  // browser would render it), then re-encode as UTF-8 bytes for the GitHub
  // blob API, which is byte-exact and encoding-agnostic once given base64.
  const text = await file.text()
  const bytes = new TextEncoder().encode(text)
  return arrayBufferToBase64(bytes.buffer)
}
