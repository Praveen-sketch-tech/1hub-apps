export function downloadBlob(
  blob: Blob,
  fileName: string,
  revokeDelayMs = 1000,
): void {
  const url = URL.createObjectURL(blob)

  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName

    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
    }, revokeDelayMs)
  }
}

export function downloadText(
  content: string,
  fileName: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  downloadBlob(
    new Blob([content], { type: mimeType }),
    fileName,
  )
}
