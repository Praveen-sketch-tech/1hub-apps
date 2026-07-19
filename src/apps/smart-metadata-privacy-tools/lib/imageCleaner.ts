import type { CleanResult, ImageOutputFormat } from './types';

const EXT_BY_FORMAT: Record<ImageOutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function stripExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

/**
 * Creates a metadata-cleaned copy of an image by fully decoding it and
 * re-encoding the pixels through <canvas>. Browsers do not write EXIF/XMP
 * data when exporting canvas content, so this reliably strips embedded
 * metadata. It is not guaranteed to be byte-for-byte identical to the
 * original image, since it may re-encode/re-compress pixel data.
 */
export async function cleanImageMetadata(
  file: File,
  outputFormat: ImageOutputFormat,
  quality = 0.92,
): Promise<CleanResult> {
  const originalFormat = file.type || 'unknown';
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This image could not be decoded by the browser and cannot be cleaned.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas 2D context is not available in this browser.');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), outputFormat, outputFormat === 'image/png' ? undefined : quality);
  });

  if (!blob) {
    throw new Error('The browser was unable to export a cleaned copy of this image.');
  }

  const ext = EXT_BY_FORMAT[outputFormat];
  const fileName = `${stripExtension(file.name)}-clean.${ext}`;

  const lossless = outputFormat === 'image/png';
  const note = lossless
    ? 'Re-encoded as PNG. All EXIF/XMP metadata was discarded during re-encoding; pixel data is lossless.'
    : `Re-encoded as ${outputFormat.replace('image/', '').toUpperCase()} at ~${Math.round(
        quality * 100,
      )}% quality. All EXIF/XMP metadata was discarded; pixel data was recompressed and is not byte-for-byte identical to the original.`;

  return {
    blob,
    fileName,
    originalFormat,
    outputFormat,
    originalSize: file.size,
    cleanedSize: blob.size,
    note,
  };
}

/** Suggests a sensible default output format based on the input file. */
export function suggestOutputFormat(file: File): ImageOutputFormat {
  const type = (file.type || '').toLowerCase();
  if (type.includes('png')) return 'image/png';
  if (type.includes('webp')) return 'image/webp';
  return 'image/jpeg';
}
