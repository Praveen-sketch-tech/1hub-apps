import { downloadBlob } from './exportList'

export async function createZip(files: File[], outputName = 'files.zip'): Promise<void> {
  const JSZipModule = await import('jszip')
  const JSZip = JSZipModule.default
  const zip = new JSZip()
  files.forEach((file) => zip.file(file.name, file))
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  downloadBlob(blob, outputName.endsWith('.zip') ? outputName : `${outputName}.zip`)
}

export async function extractZip(file: File): Promise<Array<{ name: string; blob: Blob }>> {
  const JSZipModule = await import('jszip')
  const JSZip = JSZipModule.default
  const zip = await JSZip.loadAsync(file)
  const out: Array<{ name: string; blob: Blob }> = []
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!entry.dir) out.push({ name, blob: await entry.async('blob') })
  }
  return out
}
