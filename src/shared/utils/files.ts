export function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.')

  if (index <= 0 || index === fileName.length - 1) {
    return ''
  }

  return fileName.slice(index + 1).toLowerCase()
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )

  const value = bytes / Math.pow(1024, index)

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}
