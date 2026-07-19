import JSZip from 'jszip'

export type ArchiveEntry = {
  path: string
  name: string
  size: number
  isDirectory: boolean
  date?: Date
}

export type LoadedArchive = {
  zip: JSZip
  entries: ArchiveEntry[]
}

function basename(path: string): string {
  const cleaned = path.replace(/\/+$/, '')
  const parts = cleaned.split('/')
  return parts[parts.length - 1] || cleaned
}

export async function createZip(files: File[]): Promise<Blob> {
  if (!files.length) throw new Error('Add at least one file before creating a ZIP.')
  const zip = new JSZip()
  for (const file of files) {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
    zip.file(relativePath || file.name, file)
  }
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

export async function loadZip(file: File | Blob): Promise<LoadedArchive> {
  const zip = await JSZip.loadAsync(file)
  const entries: ArchiveEntry[] = []

  await Promise.all(
    Object.values(zip.files).map(async (entry) => {
      let size = 0
      if (!entry.dir) {
        const data = await entry.async('uint8array')
        size = data.byteLength
      }
      entries.push({
        path: entry.name,
        name: basename(entry.name),
        size,
        isDirectory: entry.dir,
        date: entry.date,
      })
    }),
  )

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.path.localeCompare(b.path)
  })

  return { zip, entries }
}

export async function extractEntry(zip: JSZip, path: string): Promise<Blob> {
  const entry = zip.file(path)
  if (!entry) throw new Error(`File not found in archive: ${path}`)
  return entry.async('blob')
}

export async function extractEntries(zip: JSZip, paths: string[]): Promise<Array<{ path: string; blob: Blob }>> {
  const output: Array<{ path: string; blob: Blob }> = []
  for (const path of paths) {
    const entry = zip.file(path)
    if (!entry) continue
    output.push({ path, blob: await entry.async('blob') })
  }
  return output
}

export function isZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function safeDownloadName(path: string): string {
  return basename(path) || 'extracted-file'
}
