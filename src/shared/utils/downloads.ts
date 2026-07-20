export function downloadBlob(
  blob: Blob,
  fileName: string,
  revokeDelayMs = 1000,
): boolean {
  if (!blob || blob.size === 0) {
    // A zero-byte/undefined blob is a real failure, not a successful
    // download of an empty file — callers need to be able to tell the
    // person the download did not actually produce a usable file.
    return false
  }

  let url: string
  try {
    url = URL.createObjectURL(blob)
  } catch {
    return false
  }

  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.style.display = 'none'

    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    return true
  } catch {
    return false
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
