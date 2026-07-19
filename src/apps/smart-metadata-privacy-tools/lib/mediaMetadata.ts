import type { MetadataGroup, MetadataField } from './types';

export interface MediaInspectionResult {
  groups: MetadataGroup[];
  warnings: string[];
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Unknown';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [h, m, s].map((n, i) => (i === 0 && n === 0 ? null : String(n).padStart(2, '0'))).filter(Boolean);
  return parts.length ? parts.join(':') : `${s}s`;
}

/**
 * Reads basic, browser-exposed technical info for audio/video files
 * (duration, dimensions for video). Browsers do not expose embedded
 * ID3/QuickTime metadata (artist, device, GPS, etc.) through any public
 * web API, so this is inspection-only and does not attempt removal.
 */
export function inspectMediaMetadata(file: File, kind: 'audio' | 'video'): Promise<MediaInspectionResult> {
  return new Promise((resolve) => {
    const warnings: string[] = [
      'Browsers do not expose embedded audio/video tags (artist, device, GPS, etc.) through any public web API, so only basic technical details are shown. Automatic cleaning is not available for this file type.',
    ];

    const el = document.createElement(kind);
    el.preload = 'metadata';
    const url = URL.createObjectURL(file);
    el.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    const timeout = window.setTimeout(() => {
      cleanup();
      resolve({ groups: [], warnings: [...warnings, 'Timed out reading media metadata from this file.'] });
    }, 8000);

    el.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      const fields: MetadataField[] = [
        { key: 'duration', label: 'Duration', value: formatDuration(el.duration), sensitive: false },
      ];
      if (kind === 'video') {
        const videoEl = el as HTMLVideoElement;
        if (videoEl.videoWidth && videoEl.videoHeight) {
          fields.push({
            key: 'dimensions',
            label: 'Video Dimensions',
            value: `${videoEl.videoWidth} × ${videoEl.videoHeight}`,
            sensitive: false,
          });
        }
      }
      cleanup();
      resolve({ groups: [{ title: 'Technical Details', fields }], warnings });
    };

    el.onerror = () => {
      window.clearTimeout(timeout);
      cleanup();
      resolve({ groups: [], warnings: [...warnings, 'The browser could not read this media file.'] });
    };
  });
}
