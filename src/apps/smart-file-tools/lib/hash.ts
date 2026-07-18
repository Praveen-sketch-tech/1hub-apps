export async function sha256File(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const out: string[] = []
  for (let i = 0; i < files.length; i += 1) {
    out.push(await sha256File(files[i]))
    onProgress?.(i + 1, files.length)
  }
  return out
}
