export async function downloadBlob(blob: Blob, fileName: string, revokeDelayMs = 1500): Promise<void> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') throw new Error('Download is not available in this environment.')
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  try {
    anchor.click()
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
  } finally {
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), revokeDelayMs)
  }
}
export async function downloadText(content: string, fileName: string, mimeType = 'text/plain;charset=utf-8'): Promise<void> {
  await downloadBlob(new Blob([content], { type: mimeType }), fileName)
}
