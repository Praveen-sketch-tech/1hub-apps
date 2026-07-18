import { downloadText as sharedDownloadText } from '@shared/utils/downloads'

export function downloadText(content: string, name: string, type: string): void {
  sharedDownloadText(content, name, type)
}
