// App #003 — QR & Barcode Studio
// Small browser download helpers. No server involved.

export function sanitizeFilename(name: string, fallback: string): string {
  const trimmed = name.trim();
  const base = trimmed.length > 0 ? trimmed : fallback;
  return base.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || fallback;
}

function triggerDownload(href: string, filename: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadPngDataUrl(dataUrl: string, filename: string): void {
  try {
    triggerDownload(dataUrl, filename.endsWith('.png') ? filename : `${filename}.png`);
  } catch (err) {
    throw new Error(
      `Could not download PNG: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }
}

export function downloadSvgMarkup(svgMarkup: string, filename: string): void {
  try {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename.endsWith('.svg') ? filename : `${filename}.svg`);
    // Revoke shortly after triggering the download so the browser has time
    // to start the download before the object URL is invalidated.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    throw new Error(
      `Could not download SVG: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }
}
