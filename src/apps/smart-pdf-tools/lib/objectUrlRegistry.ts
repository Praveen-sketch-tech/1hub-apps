/**
 * Centralized registry for blob/object URLs created for thumbnails.
 *
 * Every URL.createObjectURL() call in this module should be registered here
 * so it can be reliably revoked when a page is deleted, replaced, or the
 * workspace is reset — preventing memory leaks during long sessions with
 * many uploads.
 */

const activeUrls = new Set<string>();

export function registerObjectUrl(url: string): string {
  activeUrls.add(url);
  return url;
}

export function revokeObjectUrl(url: string | undefined | null): void {
  if (!url) return;
  if (activeUrls.has(url)) {
    URL.revokeObjectURL(url);
    activeUrls.delete(url);
  }
}

export function revokeAllObjectUrls(): void {
  activeUrls.forEach((url) => URL.revokeObjectURL(url));
  activeUrls.clear();
}

export function objectUrlRegistrySize(): number {
  return activeUrls.size;
}
