/**
 * Triggers a browser file download for a Blob. Never auto-invoked by
 * generation logic — only called in response to an explicit user click on
 * a "Download" button in ResultPanel.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke shortly after to ensure the download has started in all browsers.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function sanitizeBaseName(fileName: string): string {
  const withoutExt = fileName.replace(/\.pdf$/i, '').replace(/\.(png|jpe?g|webp)$/i, '');
  return withoutExt.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'document';
}
