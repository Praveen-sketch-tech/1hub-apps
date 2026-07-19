export { downloadBlob } from '@shared/utils/downloads'
export { formatFileSize as formatBytes } from '@shared/utils/files'

/**
 * Triggers a browser file download for a Blob. Never auto-invoked by
 * generation logic — only called in response to an explicit user click on
 * a "Download" button in ResultPanel.
 */




export function sanitizeBaseName(fileName: string): string {
  const withoutExt = fileName.replace(/\.pdf$/i, '').replace(/\.(png|jpe?g|webp)$/i, '');
  return withoutExt.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'document';
}
