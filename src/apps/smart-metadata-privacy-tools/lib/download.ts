/**
 * Triggers a browser download of a Blob. This app ships with a local
 * implementation because the exact exported signature of
 * `src/shared/utils/downloads.ts` isn't known at build time. If that shared
 * utility exposes a compatible `downloadBlob(blob, fileName)` (or similar)
 * function, swap the implementation below for an import from it — see
 * README.md for details.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke slightly after the click to make sure the download has started.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, fileName: string, mimeType = 'text/plain'): void {
  downloadBlob(new Blob([text], { type: mimeType }), fileName);
}
