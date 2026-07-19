import type { BasicFileInfo, SupportedCategory } from './types';

export function detectCategory(file: File): SupportedCategory {
  const type = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();

  if (type === 'image/jpeg' || type === 'image/jpg' || /\.(jpe?g)$/.test(name)) {
    return 'image-jpeg';
  }
  if (type === 'image/png' || /\.png$/.test(name)) {
    return 'image-png';
  }
  if (type === 'image/webp' || /\.webp$/.test(name)) {
    return 'image-webp';
  }
  if (type.startsWith('image/')) {
    return 'image-other';
  }
  if (type === 'application/pdf' || /\.pdf$/.test(name)) {
    return 'pdf';
  }
  if (type.startsWith('audio/')) {
    return 'audio';
  }
  if (type.startsWith('video/')) {
    return 'video';
  }
  return 'other';
}

export function getBasicFileInfo(file: File): BasicFileInfo {
  return {
    name: file.name,
    type: file.type || 'unknown',
    size: file.size,
    lastModified: Number.isFinite(file.lastModified) ? file.lastModified : null,
    category: detectCategory(file),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  return `${exp === 0 ? value : value.toFixed(2)} ${units[exp]}`;
}

export function formatDate(epochMs: number | null | undefined): string {
  if (!epochMs && epochMs !== 0) return 'Unknown';
  try {
    return new Date(epochMs).toLocaleString();
  } catch {
    return 'Unknown';
  }
}
