import { downloadText as sharedDownloadText } from '@shared/utils/downloads'

export function downloadText(text: string, fileName: string): void {
  const finalName = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`
  sharedDownloadText(text, finalName)
}
