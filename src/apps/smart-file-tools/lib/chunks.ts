import { downloadBlob } from './exportList'
import { safeFileName } from './fileUtils'

export async function splitFile(file: File, chunkSize: number): Promise<void> {
  if (chunkSize <= 0) throw new Error('Chunk size must be greater than zero.')
  const total = Math.ceil(file.size / chunkSize)
  const width = String(total).length
  const base = safeFileName(file.name)

  for (let i = 0; i < total; i += 1) {
    const start = i * chunkSize
    const end = Math.min(file.size, start + chunkSize)
    const part = file.slice(start, end)
    downloadBlob(part, `${base}.part${String(i + 1).padStart(width, '0')}`)
    await new Promise((resolve) => window.setTimeout(resolve, 60))
  }
}

export async function mergeChunks(files: File[], outputName: string): Promise<void> {
  if (!files.length) throw new Error('Select chunk files first.')
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const blob = new Blob(sorted, { type: 'application/octet-stream' })
  downloadBlob(blob, safeFileName(outputName || 'merged-file.bin'))
}
