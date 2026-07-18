export function downloadText(text: string, fileName: string): void {
  const safeName = fileName.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-') || 'text-output.txt'
  const finalName = safeName.toLowerCase().endsWith('.txt') ? safeName : `${safeName}.txt`
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = finalName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
